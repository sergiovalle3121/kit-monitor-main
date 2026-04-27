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
import { CorrectiveProposal } from '../../modules/autopilot/entities/corrective-proposal.entity';

export interface SignalCriticalEvent {
  domain: string;
  action: string;
  referenceId?: string;
  actor?: string;
  line?: string;
  model?: string;
  metadata?: Record<string, any>;
}

/**
 * SignalGateway
 *
 * WebSocket gateway that pushes real-time signals to connected browser clients.
 *
 * Clients join a tenant room after connecting:
 *   socket.emit('join-tenant', 'default');
 *
 * Events emitted by the server:
 *   signal:new-proposal   — CorrectiveProposal created by AutopilotService
 *   signal:critical-event — Critical mutation recorded by EventLedgerInterceptor
 */
@WebSocketGateway({
  cors: { origin: '*', credentials: false },
  namespace: '/signals',
  transports: ['websocket', 'polling'],
})
export class SignalGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private readonly server: Server;

  private readonly logger = new Logger(SignalGateway.name);

  afterInit(): void {
    this.logger.log('SignalGateway initialized on namespace /signals');
  }

  handleConnection(client: Socket): void {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  /** Client sends this to subscribe to its tenant's broadcast room. */
  @SubscribeMessage('join-tenant')
  handleJoinTenant(
    @ConnectedSocket() client: Socket,
    @MessageBody() tenantId: string,
  ): void {
    const room = `tenant:${tenantId ?? 'default'}`;
    client.join(room);
    this.logger.debug(`${client.id} joined ${room}`);
    client.emit('joined', { room });
  }

  // ── Emission helpers (called by AutopilotService and EventLedgerInterceptor) ──

  emitProposal(tenantId: string, proposal: CorrectiveProposal): void {
    this.server.to(`tenant:${tenantId}`).emit('signal:new-proposal', proposal);
  }

  emitCriticalEvent(tenantId: string, event: SignalCriticalEvent): void {
    this.server
      .to(`tenant:${tenantId}`)
      .emit('signal:critical-event', event);
  }
}
