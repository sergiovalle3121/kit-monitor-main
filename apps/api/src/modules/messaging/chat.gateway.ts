import { Logger } from '@nestjs/common';
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

/**
 * ChatGateway
 *
 * WebSocket del chat interno. Cada usuario entra a su propio room `user:<id>`
 * al conectar; el servidor emite los mensajes a los rooms de TODOS los
 * miembros de la conversación.
 *
 * Presencia (online/offline): se mantiene un mapa en memoria
 * `userId -> Set<socketId>`. Un usuario está "online" mientras tenga al menos
 * un socket conectado (varias pestañas suman sockets). Las transiciones
 * (primer socket → online, último socket → offline) se difunden a todos.
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

  afterInit(): void {
    this.logger.log('ChatGateway initialized on namespace /chat');
  }

  handleConnection(client: Socket): void {
    this.logger.debug(`Chat client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Chat client disconnected: ${client.id}`);
    const userId = (client.data as { userId?: string }).userId;
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

  /** El cliente emite 'join' con su userId para recibir sus mensajes. */
  @SubscribeMessage('join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() userId: string,
  ): void {
    if (!userId) return;
    const room = `user:${userId}`;
    client.join(room);
    (client.data as { userId?: string }).userId = userId;

    const sockets = this.online.get(userId);
    const wasOffline = !sockets || sockets.size === 0;
    if (sockets) {
      sockets.add(client.id);
    } else {
      this.online.set(userId, new Set([client.id]));
    }

    client.emit('joined', { room });
    // Estado actual de presencia para el que acaba de entrar.
    client.emit('presence:state', this.getOnlineUserIds());

    // Primer socket de este usuario → pasa a online; avisar a todos.
    if (wasOffline) {
      this.server?.emit('presence:update', { userId, online: true });
    }
  }

  /** Reenvía un indicador de "escribiendo" al resto de miembros. */
  @SubscribeMessage('typing')
  handleTyping(
    @MessageBody()
    payload: {
      memberIds: string[];
      conversationId: string;
      userId: string;
    },
  ): void {
    if (!this.server || !payload?.memberIds) return;
    for (const memberId of payload.memberIds) {
      if (memberId === payload.userId) continue;
      this.server.to(`user:${memberId}`).emit('typing', {
        conversationId: payload.conversationId,
        userId: payload.userId,
      });
    }
  }

  /** Llamado por MessagingService tras persistir un mensaje. */
  emitMessageToMembers(memberIds: string[], message: unknown): void {
    if (!this.server) return;
    for (const memberId of memberIds) {
      this.server.to(`user:${memberId}`).emit('message:new', message);
    }
  }

  /** Lista de userIds actualmente en línea (≥1 socket conectado). */
  getOnlineUserIds(): string[] {
    return Array.from(this.online.keys());
  }
}
