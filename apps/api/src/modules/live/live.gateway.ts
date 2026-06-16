import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { getJwtSecret } from '../../common/config/jwt-secret';
import {
  LiveChannel,
  LiveEvent,
  LIVE_CHANNELS,
  sanitizeChannels,
} from './live-channel';

/** Data attached to the socket after authenticating the handshake. */
interface LiveSocketData {
  tenantId?: string;
  userId?: string;
}

/**
 * LiveGateway
 *
 * WebSocket spine for the "Piso en Vivo" board. Broadcasts domain events grouped
 * into the five floor channels (andon, production, quality, oee, materials).
 *
 * Security (mirrors ChatGateway P0): the handshake authenticates with the same
 * REST JWT. The tenant is derived SERVER-SIDE from the `tenant_id` claim, never
 * from the client — so nobody can listen to another tenant's floor. A handshake
 * without a valid token is disconnected.
 *
 * Rooms: every socket joins `tenant:<tid>` on connect. A client subscribes to
 * channels via the `subscribe` message and is joined to `tenant:<tid>:<channel>`
 * rooms; the poller emits each event to exactly that room. This gateway only
 * RELAYS — the event source is the read-only ledger poller (LivePollerService).
 *
 * Lives in its own namespace `/live`; does not touch SignalGateway or ChatGateway.
 */
@WebSocketGateway({
  cors: { origin: '*', credentials: false },
  namespace: '/live',
  transports: ['websocket', 'polling'],
})
export class LiveGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer()
  private readonly server: Server;

  private readonly logger = new Logger(LiveGateway.name);

  constructor(private readonly jwt: JwtService) {}

  afterInit(): void {
    this.logger.log('LiveGateway initialized on namespace /live');
  }

  /**
   * Authenticate the handshake. Valid token → derive tenant from the claim, join
   * the tenant room, greet with the channel catalog. Invalid/absent → disconnect.
   */
  handleConnection(client: Socket): void {
    const claims = this.authenticate(client);
    if (!claims) {
      this.logger.debug(`Live client rejected (no/invalid token): ${client.id}`);
      client.disconnect(true);
      return;
    }
    const tenantId = claims.tenantId ?? 'default';
    const data = client.data as LiveSocketData;
    data.tenantId = tenantId;
    data.userId = claims.userId ?? undefined;
    client.join(`tenant:${tenantId}`);
    client.emit('live:hello', {
      tenantId,
      channels: LIVE_CHANNELS,
      serverTime: new Date().toISOString(),
    });
    this.logger.debug(`Live client authed: ${client.id} tenant=${tenantId}`);
  }

  /** Subscribe to one or more channels (joins per-channel tenant rooms). */
  @SubscribeMessage('subscribe')
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { channels?: unknown },
  ): void {
    const tenantId = (client.data as LiveSocketData).tenantId ?? 'default';
    const channels = sanitizeChannels(payload?.channels);
    for (const ch of channels) client.join(this.room(tenantId, ch));
    client.emit('subscribed', { channels });
  }

  /** Unsubscribe from channels (leaves the per-channel rooms). */
  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { channels?: unknown },
  ): void {
    const tenantId = (client.data as LiveSocketData).tenantId ?? 'default';
    const channels = sanitizeChannels(payload?.channels);
    for (const ch of channels) client.leave(this.room(tenantId, ch));
    client.emit('unsubscribed', { channels });
  }

  // ── Emission (called by LivePollerService) ─────────────────────────────────

  /** Relay one mapped ledger event to its tenant's channel room. */
  broadcastEvent(tenantId: string, channel: LiveChannel, event: LiveEvent): void {
    if (!this.server) return;
    this.server.to(this.room(tenantId, channel)).emit('live:event', event);
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private room(tenantId: string, channel: LiveChannel): string {
    return `tenant:${tenantId}:${channel}`;
  }

  /** Verify the handshake JWT; return the tenant + user claims, or null. */
  private authenticate(
    client: Socket,
  ): { tenantId: string | null; userId: string | null } | null {
    const token = this.extractToken(client);
    if (!token) return null;
    try {
      const payload = this.jwt.verify<{ sub?: string; tenant_id?: string | null }>(
        token,
        { secret: getJwtSecret() },
      );
      return {
        tenantId: payload?.tenant_id ?? null,
        userId: payload?.sub ?? null,
      };
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
}
