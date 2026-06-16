import { LiveGateway } from './live.gateway';
import { JwtService } from '@nestjs/jwt';
import type { LiveEvent } from './live-channel';

/**
 * Tests for the live spine handshake: the socket authenticates with the REST
 * JWT, the tenant is derived SERVER-SIDE from the `tenant_id` claim (never the
 * client), channel subscription joins per-tenant rooms, and broadcasts target
 * exactly `tenant:<tid>:<channel>`.
 */
describe('LiveGateway (auth + channel rooms)', () => {
  let gateway: LiveGateway;
  let jwt: { verify: jest.Mock };
  let roomEmit: jest.Mock;
  let server: { to: jest.Mock };

  beforeEach(() => {
    jwt = { verify: jest.fn() };
    gateway = new LiveGateway(jwt as unknown as JwtService);
    roomEmit = jest.fn();
    server = { to: jest.fn(() => ({ emit: roomEmit })) };
    (gateway as unknown as { server: typeof server }).server = server;
  });

  function makeSocket(id: string, token?: string) {
    return {
      id,
      handshake: { auth: token ? { token } : {}, headers: {}, query: {} },
      data: {} as { tenantId?: string; userId?: string },
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
    };
  }

  it('rejects a handshake without a token', () => {
    const client = makeSocket('s1');
    gateway.handleConnection(client as never);
    expect(client.disconnect).toHaveBeenCalled();
    expect(client.join).not.toHaveBeenCalled();
  });

  it('rejects an invalid token', () => {
    jwt.verify.mockImplementation(() => {
      throw new Error('bad token');
    });
    const client = makeSocket('s1', 'tampered');
    gateway.handleConnection(client as never);
    expect(client.disconnect).toHaveBeenCalled();
  });

  it('authenticates and derives the tenant from the claim, joining the tenant room', () => {
    jwt.verify.mockReturnValue({ sub: 'u1', tenant_id: 'acme' });
    const client = makeSocket('s1', 'good');
    gateway.handleConnection(client as never);
    expect(client.disconnect).not.toHaveBeenCalled();
    expect(client.join).toHaveBeenCalledWith('tenant:acme');
    expect(client.data.tenantId).toBe('acme');
    expect(client.emit).toHaveBeenCalledWith(
      'live:hello',
      expect.objectContaining({ tenantId: 'acme' }),
    );
  });

  it('falls back to the "default" tenant when the claim is absent', () => {
    jwt.verify.mockReturnValue({ sub: 'u1' });
    const client = makeSocket('s1', 'good');
    gateway.handleConnection(client as never);
    expect(client.join).toHaveBeenCalledWith('tenant:default');
    expect(client.data.tenantId).toBe('default');
  });

  it('subscribe joins per-channel rooms for the socket tenant (ignoring bogus channels)', () => {
    const client = makeSocket('s1');
    client.data.tenantId = 'acme';
    gateway.handleSubscribe(client as never, {
      channels: ['andon', 'oee', 'bogus'],
    });
    const joined = client.join.mock.calls.map((c) => c[0]);
    expect(joined).toEqual(['tenant:acme:andon', 'tenant:acme:oee']);
    expect(client.emit).toHaveBeenCalledWith('subscribed', {
      channels: ['andon', 'oee'],
    });
  });

  it('unsubscribe leaves the per-channel rooms', () => {
    const client = makeSocket('s1');
    client.data.tenantId = 'acme';
    gateway.handleUnsubscribe(client as never, { channels: ['quality'] });
    expect(client.leave).toHaveBeenCalledWith('tenant:acme:quality');
    expect(client.emit).toHaveBeenCalledWith('unsubscribed', {
      channels: ['quality'],
    });
  });

  it('broadcastEvent emits live:event to exactly tenant:<tid>:<channel>', () => {
    const ev = { id: 'e1', channel: 'andon' } as LiveEvent;
    gateway.broadcastEvent('acme', 'andon', ev);
    expect(server.to).toHaveBeenCalledWith('tenant:acme:andon');
    expect(roomEmit).toHaveBeenCalledWith('live:event', ev);
  });

  it('broadcastEvent is a no-op before the server is bound', () => {
    const bare = new LiveGateway(jwt as unknown as JwtService);
    expect(() =>
      bare.broadcastEvent('acme', 'oee', { id: 'x' } as LiveEvent),
    ).not.toThrow();
  });
});
