import { ChatGateway } from './chat.gateway';
import { ConversationMember } from './entities/conversation-member.entity';
import { JwtService } from '@nestjs/jwt';
import type { Repository } from 'typeorm';

/**
 * Tests del fix P0 de seguridad del socket: el handshake se autentica con JWT,
 * el userId sale SIEMPRE del token (nunca del cliente), y `typing` valida la
 * pertenencia en el servidor (anti-spoofing).
 */
describe('ChatGateway (auth + presence)', () => {
  let gateway: ChatGateway;
  let jwt: { verify: jest.Mock };
  let members: { find: jest.Mock };
  let roomEmit: jest.Mock;
  let server: { emit: jest.Mock; to: jest.Mock };

  beforeEach(() => {
    jwt = { verify: jest.fn() };
    members = { find: jest.fn() };
    gateway = new ChatGateway(
      jwt as unknown as JwtService,
      members as unknown as Repository<ConversationMember>,
    );
    roomEmit = jest.fn();
    server = { emit: jest.fn(), to: jest.fn(() => ({ emit: roomEmit })) };
    (gateway as unknown as { server: typeof server }).server = server;
  });

  function makeSocket(id: string, token?: string) {
    return {
      id,
      handshake: { auth: token ? { token } : {}, headers: {}, query: {} },
      data: {} as { userId?: string },
      join: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
    };
  }

  it('rechaza el handshake sin token', () => {
    const client = makeSocket('s1');
    gateway.handleConnection(client as never);
    expect(client.disconnect).toHaveBeenCalled();
    expect(gateway.getOnlineUserIds()).toEqual([]);
  });

  it('rechaza un token inválido', () => {
    jwt.verify.mockImplementation(() => {
      throw new Error('bad token');
    });
    const client = makeSocket('s1', 'tampered');
    gateway.handleConnection(client as never);
    expect(client.disconnect).toHaveBeenCalled();
    expect(gateway.getOnlineUserIds()).toEqual([]);
  });

  it('autentica un token válido y deriva el userId del claim sub', () => {
    jwt.verify.mockReturnValue({ sub: 'u1' });
    const client = makeSocket('s1', 'good');
    gateway.handleConnection(client as never);
    expect(client.disconnect).not.toHaveBeenCalled();
    expect(client.join).toHaveBeenCalledWith('user:u1');
    expect(client.data.userId).toBe('u1');
    expect(client.emit).toHaveBeenCalledWith('presence:state', ['u1']);
    expect(server.emit).toHaveBeenCalledWith('presence:update', {
      userId: 'u1',
      online: true,
    });
    expect(gateway.getOnlineUserIds()).toEqual(['u1']);
  });

  it('ignora el userId del payload: solo se une al room del token', () => {
    jwt.verify.mockReturnValue({ sub: 'u1' });
    const client = makeSocket('s1', 'good');
    gateway.handleConnection(client as never);
    gateway.handleJoin(client as never);
    // Nunca se une a un room que no sea el suyo, pase lo que pase el cliente.
    const joinedRooms = client.join.mock.calls.map((c) => c[0]);
    expect(joinedRooms.every((r) => r === 'user:u1')).toBe(true);
  });

  it('no marca offline dos veces ni hasta cerrar el último socket', () => {
    jwt.verify.mockReturnValue({ sub: 'u1' });
    const a = makeSocket('s1', 'good');
    const b = makeSocket('s2', 'good');
    gateway.handleConnection(a as never);
    gateway.handleConnection(b as never);
    expect(gateway.getOnlineUserIds()).toEqual(['u1']);

    gateway.handleDisconnect(a as never);
    expect(gateway.getOnlineUserIds()).toEqual(['u1']); // aún queda s2

    server.emit.mockClear();
    gateway.handleDisconnect(b as never);
    expect(gateway.getOnlineUserIds()).toEqual([]);
    expect(server.emit).toHaveBeenCalledWith('presence:update', {
      userId: 'u1',
      online: false,
    });
  });

  it('typing: ignora a quien no es miembro (anti-spoof)', async () => {
    members.find.mockResolvedValue([{ userId: 'u2' }, { userId: 'u3' }]);
    const client = makeSocket('s1', 'good');
    client.data.userId = 'u1'; // no es miembro
    await gateway.handleTyping(client as never, { conversationId: 'c1' });
    expect(server.to).not.toHaveBeenCalled();
  });

  it('typing: reenvía a los demás miembros (no a sí mismo)', async () => {
    members.find.mockResolvedValue([
      { userId: 'u1' },
      { userId: 'u2' },
      { userId: 'u3' },
    ]);
    const client = makeSocket('s1', 'good');
    client.data.userId = 'u1';
    await gateway.handleTyping(client as never, { conversationId: 'c1' });
    const targets = server.to.mock.calls.map((c) => c[0]);
    expect(targets).toEqual(['user:u2', 'user:u3']);
    expect(targets).not.toContain('user:u1');
  });
});
