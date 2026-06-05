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

  afterInit(): void {
    this.logger.log('ChatGateway initialized on namespace /chat');
  }

  handleConnection(client: Socket): void {
    this.logger.debug(`Chat client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Chat client disconnected: ${client.id}`);
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
    client.emit('joined', { room });
  }

  /** Reenvía un indicador de "escribiendo" al resto de miembros. */
  @SubscribeMessage('typing')
  handleTyping(
    @MessageBody()
    payload: { memberIds: string[]; conversationId: string; userId: string },
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
}
