import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ConversationMember } from './entities/conversation-member.entity';
import { User } from '../users/entities/user.entity';
import { getJwtSecret } from '../../common/config/jwt-secret';

/** Datos que adjuntamos al socket tras autenticar el handshake. */
interface ChatSocketData {
  userId?: string;
}

export type PresenceStatus = 'available' | 'busy' | 'away';

function normalizeStatus(s: unknown): PresenceStatus {
  return s === 'busy' || s === 'away' ? s : 'available';
}

/**
 * ChatGateway
 *
 * WebSocket del chat interno. Cada usuario entra a su propio room `user:<id>`
 * al conectar; el servidor emite los mensajes a los rooms de TODOS los
 * miembros de la conversación.
 *
 * Seguridad (P0): el socket se autentica en el HANDSHAKE con el mismo JWT del
 * REST. El `userId` se deriva SIEMPRE del token (claim `sub`), nunca de un
 * payload del cliente — así nadie puede escuchar el room de otro usuario. Un
 * handshake sin token válido se desconecta. La pertenencia a una conversación
 * (p. ej. para `typing`) se valida en el servidor, no se confía en el cliente.
 *
 * Presencia (online/offline): mapa en memoria `userId -> Set<socketId>`. Un
 * usuario está "online" mientras tenga al menos un socket conectado (varias
 * pestañas suman sockets). Las transiciones (primer socket → online, último
 * socket → offline) se difunden a todos.
 *
 * No modifica SignalGateway: vive en su propio namespace '/chat'.
 */
@WebSocketGateway({
  cors: { origin: '*', credentials: false },
  namespace: '/chat',
  transports: ['websocket', 'polling'],
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private readonly server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  /** Usuarios en línea → conjunto de sockets activos de cada uno. */
  private readonly online = new Map<string, Set<string>>();

  /** Estado de disponibilidad por usuario (en memoria, mientras está online). */
  private readonly statuses = new Map<string, PresenceStatus>();

  /** Llamadas en curso → participantes (userIds). callId → Set<userId>. */
  private readonly callRooms = new Map<string, Set<string>>();

  constructor(
    private readonly jwt: JwtService,
    @InjectRepository(ConversationMember)
    private readonly members: Repository<ConversationMember>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  private statusOf(userId: string): PresenceStatus {
    return this.statuses.get(userId) ?? 'available';
  }

  /** Estado de presencia actual: usuarios online con su estado. */
  private getPresenceState(): { userId: string; status: PresenceStatus }[] {
    return Array.from(this.online.keys()).map((userId) => ({
      userId,
      status: this.statusOf(userId),
    }));
  }

  afterInit(): void {
    this.logger.log('ChatGateway initialized on namespace /chat');
  }

  /**
   * Autentica el handshake. Token válido → registra presencia y room propio.
   * Token ausente/ inválido → desconecta (no se confía en el cliente).
   */
  handleConnection(client: Socket): void {
    const userId = this.authenticate(client);
    if (!userId) {
      this.logger.debug(
        `Chat client rejected (no/invalid token): ${client.id}`,
      );
      client.disconnect(true);
      return;
    }
    (client.data as ChatSocketData).userId = userId;
    client.join(`user:${userId}`);

    const sockets = this.online.get(userId);
    const wasOffline = !sockets || sockets.size === 0;
    if (sockets) {
      sockets.add(client.id);
    } else {
      this.online.set(userId, new Set([client.id]));
    }

    // Estado actual de presencia para el que acaba de entrar.
    client.emit('presence:state', this.getPresenceState());
    // Primer socket de este usuario → pasa a online; avisar a todos.
    if (wasOffline) {
      this.server?.emit('presence:update', {
        userId,
        online: true,
        status: this.statusOf(userId),
      });
    }
    this.logger.debug(`Chat client authed: ${client.id} user=${userId}`);
  }

  handleDisconnect(client: Socket): void {
    const userId = (client.data as ChatSocketData).userId;
    if (!userId) return;
    const sockets = this.online.get(userId);
    if (!sockets) return;
    sockets.delete(client.id);
    if (sockets.size === 0) {
      this.online.delete(userId);
      this.statuses.delete(userId);
      // Persiste "visto por última vez" (mejor esfuerzo).
      void this.users
        .update(userId, { lastSeenAt: new Date() })
        .catch(() => undefined);
      // Último socket cerrado → el usuario pasa a offline.
      this.server?.emit('presence:update', { userId, online: false });
      // Si estaba en alguna llamada, lo sacamos y avisamos a sus pares.
      for (const callId of Array.from(this.callRooms.keys())) {
        if (this.callRooms.get(callId)?.has(userId)) {
          this.leaveCall(userId, callId);
        }
      }
    }
  }

  /** El usuario fija su estado (disponible/ocupado/ausente); se difunde a todos. */
  @SubscribeMessage('presence:set-status')
  handleSetStatus(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { status?: string },
  ): void {
    const userId = (client.data as ChatSocketData).userId;
    if (!this.server || !userId) return;
    const status = normalizeStatus(payload?.status);
    this.statuses.set(userId, status);
    this.server.emit('presence:update', { userId, online: true, status });
  }

  /**
   * Reafirma el room propio del usuario (idempotente). El `userId` viene del
   * token (client.data), NO del payload — un `join('otro')` no da acceso a
   * rooms ajenos. Se mantiene por compatibilidad con el cliente actual.
   */
  @SubscribeMessage('join')
  handleJoin(@ConnectedSocket() client: Socket): void {
    const userId = (client.data as ChatSocketData).userId;
    if (!userId) return;
    const room = `user:${userId}`;
    client.join(room);
    client.emit('joined', { room });
    client.emit('presence:state', this.getPresenceState());
  }

  /**
   * Reenvía un indicador de "escribiendo" al resto de miembros. El emisor sale
   * del token; los destinatarios se derivan en el servidor a partir de la
   * conversación (anti-spoofing: si el emisor no es miembro, se ignora).
   */
  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId?: string },
  ): Promise<void> {
    const userId = (client.data as ChatSocketData).userId;
    const conversationId = payload?.conversationId;
    if (!this.server || !userId || !conversationId) return;

    const memberRows = await this.members.find({ where: { conversationId } });
    const memberIds = memberRows.map((m) => m.userId);
    if (!memberIds.includes(userId)) return; // no es miembro → ignorar

    for (const memberId of memberIds) {
      if (memberId === userId) continue;
      this.server.to(`user:${memberId}`).emit('typing', {
        conversationId,
        userId,
      });
    }
  }

  // ── Señalización de llamadas (WebRTC, malla 1:N) ──────────────────────────
  //
  // El servidor SOLO retransmite y lleva el registro de PARTICIPANTES por llamada
  // (`callRooms`: callId → userIds). Una llamada 1:1 es una sala de 2. El emisor
  // sale del token; la pertenencia a la conversación se valida (anti-spoofing).
  // El SDP/ICE viaja por `call:signal` hacia un destinatario concreto.
  //
  // Negociación sin glare: cuando alguien se une, los participantes EXISTENTES
  // inician la oferta hacia el recién llegado; el recién llegado solo responde.

  /** A inicia una llamada → crea la sala y avisa al resto de miembros. */
  @SubscribeMessage('call:invite')
  async handleCallInvite(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      conversationId?: string;
      callId?: string;
      media?: 'audio' | 'video';
    },
  ): Promise<void> {
    const fromUserId = (client.data as ChatSocketData).userId;
    const { conversationId, callId } = payload ?? {};
    if (!this.server || !fromUserId || !conversationId || !callId) return;
    const memberIds = await this.membersOf(conversationId);
    if (!memberIds.includes(fromUserId)) return; // no es miembro → ignorar
    const media = payload?.media === 'video' ? 'video' : 'audio';
    this.callRooms.set(callId, new Set([fromUserId]));
    for (const memberId of memberIds) {
      if (memberId === fromUserId) continue;
      this.server.to(`user:${memberId}`).emit('call:incoming', {
        conversationId,
        callId,
        fromUserId,
        media,
      });
    }
  }

  /** Me uno a la llamada → me registran, me dan la lista y avisan a los demás. */
  @SubscribeMessage('call:join')
  async handleCallJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId?: string; callId?: string },
  ): Promise<void> {
    const fromUserId = (client.data as ChatSocketData).userId;
    const { conversationId, callId } = payload ?? {};
    if (!this.server || !fromUserId || !conversationId || !callId) return;
    const memberIds = await this.membersOf(conversationId);
    if (!memberIds.includes(fromUserId)) return; // no es miembro → ignorar

    let room = this.callRooms.get(callId);
    if (!room) {
      room = new Set();
      this.callRooms.set(callId, room);
    }
    const existing = Array.from(room).filter((id) => id !== fromUserId);
    room.add(fromUserId);

    // Al que se une: quiénes ya están dentro.
    this.server
      .to(`user:${fromUserId}`)
      .emit('call:participants', { callId, conversationId, participants: existing });
    // A los que ya estaban: hay un nuevo (ellos inician la oferta).
    for (const id of existing) {
      this.server
        .to(`user:${id}`)
        .emit('call:peer-joined', { callId, conversationId, userId: fromUserId });
    }
  }

  /** Intercambio de SDP/ICE entre dos pares (offer/answer/candidate). */
  @SubscribeMessage('call:signal')
  handleCallSignal(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      conversationId?: string;
      callId?: string;
      toUserId?: string;
      data?: unknown;
    },
  ): Promise<void> {
    return this.relayToUser(client, 'call:signal', payload);
  }

  /** Rechazo de la invitación (en 1:1 termina; en grupo es informativo). */
  @SubscribeMessage('call:reject')
  handleCallReject(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId?: string; callId?: string },
  ): Promise<void> {
    return this.relayToOthers(client, 'call:rejected', payload);
  }

  /** A cancela antes de que contesten → avisa al resto y limpia la sala. */
  @SubscribeMessage('call:cancel')
  handleCallCancel(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId?: string; callId?: string },
  ): Promise<void> {
    if (payload?.callId) this.callRooms.delete(payload.callId);
    return this.relayToOthers(client, 'call:canceled', payload);
  }

  /** Salgo/cuelgo → me quitan de la sala y avisan a los que quedan. */
  @SubscribeMessage('call:leave')
  handleCallLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { callId?: string },
  ): void {
    this.leaveCall((client.data as ChatSocketData).userId, payload?.callId);
  }

  /** Alias de salida (compatibilidad): colgar = salir de la sala. */
  @SubscribeMessage('call:end')
  handleCallEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { callId?: string },
  ): void {
    this.leaveCall((client.data as ChatSocketData).userId, payload?.callId);
  }

  /** Quita a un usuario de la sala y avisa 'call:peer-left' a los que quedan. */
  private leaveCall(userId?: string, callId?: string): void {
    if (!this.server || !userId || !callId) return;
    const room = this.callRooms.get(callId);
    if (!room || !room.has(userId)) return;
    room.delete(userId);
    for (const id of room) {
      this.server.to(`user:${id}`).emit('call:peer-left', { callId, userId });
    }
    if (room.size === 0) this.callRooms.delete(callId);
  }

  // ── Emisores llamados por MessagingService tras persistir ──────────────────

  /** Mensaje nuevo a todos los miembros de la conversación. */
  emitMessageToMembers(memberIds: string[], message: unknown): void {
    this.emitToMembers(memberIds, 'message:new', message);
  }

  /** Mensaje ACTUALIZADO (editado/eliminado/fijado) a todos los miembros. */
  emitMessageUpdate(memberIds: string[], message: unknown): void {
    this.emitToMembers(memberIds, 'message:updated', message);
  }

  /** Conversación cambió (miembros/nombre) → los clientes refrescan su lista. */
  emitConversationUpdate(memberIds: string[], conversationId: string): void {
    this.emitToMembers(memberIds, 'conversation:updated', { conversationId });
  }

  /** Mensaje eliminado del todo (temporal expirado) → quitar del hilo. */
  emitMessageRemoved(
    memberIds: string[],
    payload: { id: string; conversationId: string },
  ): void {
    this.emitToMembers(memberIds, 'message:removed', payload);
  }

  /** Reacciones agregadas actualizadas de un mensaje. */
  emitReactionUpdate(
    memberIds: string[],
    payload: { messageId: string; reactions: unknown },
  ): void {
    this.emitToMembers(memberIds, 'reaction:update', payload);
  }

  /** Recibo de lectura: un usuario actualizó su `lastReadAt` en la conversación. */
  emitReadUpdate(
    memberIds: string[],
    payload: { conversationId: string; userId: string; lastReadAt: Date },
  ): void {
    this.emitToMembers(memberIds, 'read:update', payload);
  }

  /** Notifica a cada usuario mencionado en un mensaje (badge/toast). */
  emitMentionToUsers(
    userIds: string[],
    payload: { conversationId: string; messageId: string; byUserId: string },
  ): void {
    this.emitToMembers(userIds, 'mention:new', payload);
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  /** Emite un evento a los rooms `user:<id>` de los miembros dados. */
  private emitToMembers(
    memberIds: string[],
    event: string,
    payload: unknown,
  ): void {
    if (!this.server) return;
    for (const memberId of memberIds) {
      this.server.to(`user:${memberId}`).emit(event, payload);
    }
  }

  /** Lista de userIds actualmente en línea (≥1 socket conectado). */
  getOnlineUserIds(): string[] {
    return Array.from(this.online.keys());
  }

  /** IDs de los miembros de una conversación. */
  private async membersOf(conversationId: string): Promise<string[]> {
    const rows = await this.members.find({ where: { conversationId } });
    return rows.map((m) => m.userId);
  }

  /**
   * Retransmite un evento a UN destinatario concreto (`toUserId`), añadiendo
   * `fromUserId` desde el token. Exige que AMBOS sean miembros (anti-spoofing).
   */
  private async relayToUser(
    client: Socket,
    event: string,
    payload: { conversationId?: string; toUserId?: string; [k: string]: unknown },
  ): Promise<void> {
    const fromUserId = (client.data as ChatSocketData).userId;
    const { conversationId, toUserId } = payload ?? {};
    if (!this.server || !fromUserId || !conversationId || !toUserId) return;
    const memberIds = await this.membersOf(conversationId);
    if (!memberIds.includes(fromUserId) || !memberIds.includes(toUserId)) return;
    this.server.to(`user:${toUserId}`).emit(event, { ...payload, fromUserId });
  }

  /**
   * Retransmite un evento al RESTO de miembros de la conversación (no al emisor),
   * añadiendo `fromUserId` desde el token. Exige que el emisor sea miembro.
   */
  private async relayToOthers(
    client: Socket,
    event: string,
    payload: { conversationId?: string; [k: string]: unknown },
  ): Promise<void> {
    const fromUserId = (client.data as ChatSocketData).userId;
    const { conversationId } = payload ?? {};
    if (!this.server || !fromUserId || !conversationId) return;
    const memberIds = await this.membersOf(conversationId);
    if (!memberIds.includes(fromUserId)) return;
    for (const memberId of memberIds) {
      if (memberId === fromUserId) continue;
      this.server.to(`user:${memberId}`).emit(event, { ...payload, fromUserId });
    }
  }

  /** Verifica el JWT del handshake y devuelve el userId (claim `sub`). */
  private authenticate(client: Socket): string | null {
    const token = this.extractToken(client);
    if (!token) return null;
    try {
      const payload = this.jwt.verify<{ sub?: string }>(token, {
        secret: getJwtSecret(),
      });
      return payload?.sub ?? null;
    } catch {
      return null;
    }
  }

  /** Extrae el token del handshake: auth.token, header Authorization o query. */
  private extractToken(client: Socket): string | null {
    const auth = client.handshake?.auth as { token?: string } | undefined;
    if (auth?.token) return auth.token.replace(/^Bearer\s+/i, '');
    const header = client.handshake?.headers?.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice(7);
    }
    const q = client.handshake?.query?.token;
    if (typeof q === 'string') return q;
    return null;
  }
}
