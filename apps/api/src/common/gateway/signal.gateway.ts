import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { getJwtSecret } from '../config/jwt-secret';
import { CorrectiveProposal } from '../../modules/autopilot/entities/corrective-proposal.entity';

/** Data attached to the socket after authenticating the handshake. */
interface SignalSocketData {
  tenantId?: string;
}

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

  constructor(private readonly jwt: JwtService) {}

  afterInit(): void {
    this.logger.log('SignalGateway initialized on namespace /signals');
  }

  /**
   * Authenticate the handshake (mirrors ChatGateway/LiveGateway). A valid JWT
   * derives the tenant SERVER-SIDE from the `tenant_id` claim and joins only that
   * tenant's room; an absent/invalid token is disconnected. Previously this
   * gateway accepted any client and let it `join-tenant '<anyTenant>'`, leaking
   * cross-tenant proposals and critical events.
   */
  handleConnection(client: Socket): void {
    const claims = this.authenticate(client);
    if (!claims) {
      this.logger.debug(`Signal client rejected (no/invalid token): ${client.id}`);
      client.disconnect(true);
      return;
    }
    const tenantId = claims.tenantId ?? 'default';
    (client.data as SignalSocketData).tenantId = tenantId;
    const room = `tenant:${tenantId}`;
    client.join(room);
    this.logger.debug(`Signal client authed: ${client.id} tenant=${tenantId}`);
    client.emit('joined', { room });
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  /**
   * Back-compat no-op subscribe. The tenant room is derived from the
   * authenticated handshake, so the client-supplied tenant id is IGNORED — a
   * client can only ever be in its own tenant room.
   */
  @SubscribeMessage('join-tenant')
  handleJoinTenant(@ConnectedSocket() client: Socket): void {
    const tenantId = (client.data as SignalSocketData).tenantId ?? 'default';
    const room = `tenant:${tenantId}`;
    client.join(room);
    client.emit('joined', { room });
  }

  /** Verify the handshake JWT; return the tenant claim, or null. */
  private authenticate(client: Socket): { tenantId: string | null } | null {
    const token = this.extractToken(client);
    if (!token) return null;
    try {
      const payload = this.jwt.verify<{ tenant_id?: string | null }>(token, {
        secret: getJwtSecret(),
      });
      return { tenantId: payload?.tenant_id ?? null };
    } catch {
      return null;
    }
  }

  /** Extract the token from the handshake: auth.token, Authorization header, or query. */
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

  // ── Emission helpers (called by AutopilotService and EventLedgerInterceptor) ──

  emitProposal(tenantId: string, proposal: CorrectiveProposal): void {
    if (this.server) {
      this.server
        .to(`tenant:${tenantId}`)
        .emit('signal:new-proposal', proposal);
    }
  }

  emitCriticalEvent(tenantId: string, event: SignalCriticalEvent): void {
    if (this.server) {
      this.server.to(`tenant:${tenantId}`).emit('signal:critical-event', event);
    }
  }

  /** Generic broadcast to a tenant room — used by the materials pull system. */
  emitToTenant(tenantId: string, event: string, payload: unknown): void {
    if (this.server) {
      this.server.to(`tenant:${tenantId ?? 'default'}`).emit(event, payload);
    }
  }
}
