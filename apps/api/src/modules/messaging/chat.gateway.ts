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
import { getJwtSecret } from '../../common/config/jwt-secret';

/** Datos que adjuntamos al socket tras autenticar el handshake. */
interface ChatSocketData {
  userId?: string;
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

  constructor(
    private readonly jwt: JwtService,
    @InjectRepository(ConversationMember)
    private readonly members: Repository<ConversationMember>,
  ) {}

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
    client.emit('presence:state', this.getOnlineUserIds());
    // Primer socket de este usuario → pasa a online; avisar a todos.
    if (wasOffline) {
      this.server?.emit('presence:update', { userId, online: true });
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
      // Último socket cerrado → el usuario pasa a offline.
      this.server?.emit('presence:update', { userId, online: false });
    }
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
    client.emit('presence:state', this.getOnlineUserIds());
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

  // ── Emisores llamados por MessagingService tras persistir ──────────────────

  /** Mensaje nuevo a todos los miembros de la conversación. */
  emitMessageToMembers(memberIds: string[], message: unknown): void {
    this.emitToMembers(memberIds, 'message:new', message);
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
