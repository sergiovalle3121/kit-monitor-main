import {
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AiService, ReqUser } from './ai.service';
import { CideEngineError } from './cide-provider';

/**
 * Exercises the agentic tool loop in isolation against a scripted fake engine.
 * runCide() only depends on the tools service and the provider, so the repos and
 * ModuleRef can be stubbed — this verifies the loop wiring (tool dispatch, usage
 * accounting, streaming fan-out, engine-error mapping) without a live engine.
 */
function makeService(toolsExecute: jest.Mock): AiService {
  const tools = { execute: toolsExecute } as unknown as never;
  return new AiService(
    null as never, // configRepo
    null as never, // usageRepo
    null as never, // convRepo
    null as never, // msgRepo
    tools,
    null as never, // moduleRef
  );
}

const SPECS = [
  { name: 'operations_pulse', description: 'pulse', parameters: { type: 'object' } },
];
const CTX = { user: {}, isAdmin: false, permissions: [] } as never;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const runCide = (s: AiService, ...args: any[]) => (s as any).runCide(...args);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stubProvider = (s: AiService, provider: any) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  jest.spyOn(s as any, 'createProvider').mockReturnValue(provider);

describe('AiService agentic loop (runCide)', () => {
  it('calls the requested tool, feeds the result back, and returns the final answer', async () => {
    const execute = jest.fn().mockResolvedValue({ ok: true });
    const service = makeService(execute);
    const provider = {
      chat: jest
        .fn()
        .mockResolvedValueOnce({
          content: '',
          toolCalls: [
            { id: 'c1', name: 'operations_pulse', arguments: { since: 7 } },
          ],
          usage: { inputTokens: 10, outputTokens: 5 },
        })
        .mockResolvedValueOnce({
          content: 'Producción estable.',
          toolCalls: [],
          usage: { inputTokens: 8, outputTokens: 4 },
        }),
    };
    stubProvider(service, provider);

    const res = await runCide(
      service,
      'qwen2.5:7b',
      'system',
      [],
      'hola',
      SPECS,
      CTX,
    );

    expect(res.text).toBe('Producción estable.');
    expect(res.toolsUsed).toEqual(['operations_pulse']);
    expect(execute).toHaveBeenCalledWith(
      'operations_pulse',
      { since: 7 },
      CTX,
    );
    // usage is summed across both rounds
    expect(res.usage.inputTokens).toBe(18);
    expect(res.usage.outputTokens).toBe(9);
    expect(provider.chat).toHaveBeenCalledTimes(2);
  });

  it('streams the final answer and announces each tool when a sink is given', async () => {
    const execute = jest.fn().mockResolvedValue({ rows: [] });
    const service = makeService(execute);
    const provider = {
      chatStream: jest
        .fn()
        .mockResolvedValueOnce({
          content: '',
          toolCalls: [
            { id: 'c1', name: 'inventory_snapshot', arguments: {} },
          ],
          usage: { inputTokens: 5, outputTokens: 2 },
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .mockImplementationOnce(async (args: any) => {
          args.onDelta('Hola ');
          args.onDelta('mundo');
          return {
            content: 'Hola mundo',
            toolCalls: [],
            usage: { inputTokens: 3, outputTokens: 2 },
          };
        }),
    };
    stubProvider(service, provider);

    const deltas: string[] = [];
    const toolsSeen: string[] = [];
    const res = await runCide(
      service,
      'qwen2.5:7b',
      'system',
      [],
      'q',
      SPECS,
      CTX,
      { onDelta: (t: string) => deltas.push(t), onTool: (n: string) => toolsSeen.push(n) },
    );

    expect(deltas.join('')).toBe('Hola mundo');
    expect(toolsSeen).toEqual(['inventory_snapshot']);
    expect(res.text).toBe('Hola mundo');
    expect(provider.chatStream).toHaveBeenCalledTimes(2);
  });

  it('maps an engine outage to a ServiceUnavailableException', async () => {
    const service = makeService(jest.fn());
    stubProvider(service, {
      chat: jest.fn().mockRejectedValue(new CideEngineError('engine down')),
    });

    await expect(
      runCide(service, 'qwen2.5:7b', 'system', [], 'q', [], CTX),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe('AiService.deleteConversation', () => {
  const owner: ReqUser = {
    userId: 'u1',
    email: 'a@b.com',
    role: 'User',
  };
  function serviceWith(conv: unknown) {
    const convRepo = {
      findOne: jest.fn().mockResolvedValue(conv),
      delete: jest.fn().mockResolvedValue({}),
    };
    const msgRepo = { delete: jest.fn().mockResolvedValue({}) };
    const service = new AiService(
      null as never,
      null as never,
      convRepo as never,
      msgRepo as never,
      { execute: jest.fn() } as never,
      null as never,
    );
    return { service, convRepo, msgRepo };
  }

  it('throws NotFound when the conversation does not exist', async () => {
    const { service } = serviceWith(null);
    await expect(
      service.deleteConversation(owner, 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('forbids deleting another user’s conversation (non-admin)', async () => {
    const { service } = serviceWith({ id: 'x', userEmail: 'other@b.com' });
    await expect(
      service.deleteConversation(owner, 'x'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('deletes the conversation and its messages for the owner', async () => {
    const { service, convRepo, msgRepo } = serviceWith({
      id: 'x',
      userEmail: 'a@b.com',
    });
    const res = await service.deleteConversation(owner, 'x');
    expect(msgRepo.delete).toHaveBeenCalledWith({ conversationId: 'x' });
    expect(convRepo.delete).toHaveBeenCalledWith({ id: 'x' });
    expect(res).toEqual({ deleted: true, id: 'x' });
  });

  it('lets an admin delete any conversation', async () => {
    const { service, convRepo } = serviceWith({
      id: 'x',
      userEmail: 'other@b.com',
    });
    const admin: ReqUser = { userId: 'a', email: 'admin@b.com', role: 'Admin' };
    await service.deleteConversation(admin, 'x');
    expect(convRepo.delete).toHaveBeenCalledWith({ id: 'x' });
  });
});

describe('AiService.renameConversation', () => {
  const owner: ReqUser = { userId: 'u1', email: 'a@b.com', role: 'User' };
  function serviceWith(conv: unknown) {
    const convRepo = {
      findOne: jest.fn().mockResolvedValue(conv),
      save: jest.fn().mockImplementation((c) => Promise.resolve(c)),
    };
    const service = new AiService(
      null as never,
      null as never,
      convRepo as never,
      { delete: jest.fn() } as never,
      { execute: jest.fn() } as never,
      null as never,
    );
    return { service, convRepo };
  }

  it('throws NotFound when the conversation does not exist', async () => {
    const { service } = serviceWith(null);
    await expect(
      service.renameConversation(owner, 'missing', 'Hola'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('forbids renaming another user’s conversation (non-admin)', async () => {
    const { service } = serviceWith({ id: 'x', userEmail: 'other@b.com' });
    await expect(
      service.renameConversation(owner, 'x', 'Hola'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('trims, caps at 200 chars and persists the new title for the owner', async () => {
    const { service, convRepo } = serviceWith({ id: 'x', userEmail: 'a@b.com' });
    const res = await service.renameConversation(owner, 'x', '  Análisis OEE  ');
    expect(res).toEqual({ id: 'x', title: 'Análisis OEE' });
    expect(convRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'x', title: 'Análisis OEE' }),
    );
  });

  it('falls back to a default title when the new title is blank', async () => {
    const { service } = serviceWith({ id: 'x', userEmail: 'a@b.com' });
    const res = await service.renameConversation(owner, 'x', '   ');
    expect(res.title).toBe('Nueva conversación');
  });
});

describe('AiService.setConfig (auto-escalation)', () => {
  function setup(stored: Record<string, unknown>) {
    const cfg = {
      tenantId: '__default__',
      enabled: true,
      defaultModel: 'qwen2.5:7b',
      escalationModel: 'qwen2.5:32b',
      monthlyTokenBudget: 1_000_000,
      tokensUsedThisPeriod: 0,
      rateLimitPerHour: 60,
      periodStart: null,
      autoEscalate: null,
      ...stored,
    };
    const configRepo = {
      findOne: jest.fn().mockResolvedValue(cfg),
      save: jest.fn().mockImplementation((c) => Promise.resolve(c)),
    };
    const service = new AiService(
      configRepo as never,
      null as never,
      null as never,
      null as never,
      { execute: jest.fn() } as never,
      null as never,
    );
    return { service, configRepo, cfg };
  }
  const admin: ReqUser = { userId: 'a', email: 'admin@b.com', role: 'Admin' };

  it('persists the tenant auto-escalation override and reports its source', async () => {
    const { service, configRepo } = setup({ autoEscalate: null });
    const out = await service.setConfig(admin, { autoEscalate: true });
    expect(configRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ autoEscalate: true }),
    );
    expect(out.autoEscalate).toBe(true);
    expect(out.autoEscalateSource).toBe('tenant');
  });

  it('reports the process default when no tenant override is set', async () => {
    const { service } = setup({ autoEscalate: null });
    const out = await service.getConfigPublic(admin);
    // env CIDE_AUTO_ESCALATE is unset in tests → default false, source "default".
    expect(out.autoEscalate).toBe(false);
    expect(out.autoEscalateSource).toBe('default');
  });
});

describe('AiService.persistTurn', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function setup(prepared: any) {
    const msgRepo = {
      create: jest.fn().mockImplementation((x) => x),
      save: jest.fn().mockResolvedValue({}),
    };
    const usageRepo = {
      create: jest.fn().mockImplementation((x) => x),
      save: jest.fn().mockResolvedValue({}),
    };
    const convRepo = { update: jest.fn().mockResolvedValue({}) };
    const configRepo = { save: jest.fn().mockResolvedValue({}) };
    const service = new AiService(
      configRepo as never,
      usageRepo as never,
      convRepo as never,
      msgRepo as never,
      { execute: jest.fn() } as never,
      null as never,
    );
    const reqUser: ReqUser = { userId: 'u', email: 'a@b.com', role: 'User' };
    const result = {
      text: 'ok',
      usage: {
        inputTokens: 4,
        outputTokens: 2,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      },
      toolsUsed: [],
      cards: [],
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const persist = (service as any).persistTurn.bind(service);
    return { persist, reqUser, result, msgRepo };
  }

  it('stores the model and escalation flag on the assistant message', async () => {
    const { persist, reqUser, result, msgRepo } = setup(null);
    await persist(
      reqUser,
      {
        tenantId: 't',
        cfg: { tokensUsedThisPeriod: 0 },
        conv: { id: 'c1' },
        model: 'qwen2.5:32b',
        escalated: true,
        mock: false,
      },
      'hola',
      result,
    );
    const assistantCreate = msgRepo.create.mock.calls
      .map((c: unknown[]) => c[0] as Record<string, unknown>)
      .find((c) => c.role === 'assistant');
    expect(assistantCreate).toMatchObject({
      model: 'qwen2.5:32b',
      escalated: true,
    });
  });

  it('does not attribute a model on demo (mock) turns', async () => {
    const { persist, reqUser, result, msgRepo } = setup(null);
    await persist(
      reqUser,
      {
        tenantId: 't',
        cfg: { tokensUsedThisPeriod: 0 },
        conv: { id: 'c1' },
        model: 'qwen2.5:7b',
        escalated: false,
        mock: true,
      },
      'hola',
      result,
    );
    const assistantCreate = msgRepo.create.mock.calls
      .map((c: unknown[]) => c[0] as Record<string, unknown>)
      .find((c) => c.role === 'assistant');
    expect(assistantCreate?.model).toBeNull();
    expect(assistantCreate?.escalated).toBeNull();
  });
});

describe('AiService company knowledge', () => {
  function svc() {
    return new AiService(
      null as never,
      null as never,
      null as never,
      null as never,
      { execute: jest.fn() } as never,
      null as never,
    );
  }
  const user: ReqUser = { userId: 'u', email: 'a@b.com', role: 'User' };

  it('injects admin knowledge into the system prompt', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sys = (svc() as any).buildSystem(user, 'AXOS factura los viernes.');
    expect(sys).toContain('CONOCIMIENTO DE LA EMPRESA');
    expect(sys).toContain('AXOS factura los viernes.');
  });

  it('omits the knowledge block when none is set', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sys = (svc() as any).buildSystem(user);
    expect(sys).not.toContain('CONOCIMIENTO DE LA EMPRESA');
  });

  it('setConfig persists trimmed knowledge and clears it when blank', async () => {
    const cfg: Record<string, unknown> = {
      tenantId: '__default__',
      enabled: true,
      defaultModel: 'qwen2.5:7b',
      escalationModel: 'qwen2.5:32b',
      monthlyTokenBudget: 1_000_000,
      tokensUsedThisPeriod: 0,
      rateLimitPerHour: 60,
      periodStart: null,
      autoEscalate: null,
      knowledge: null,
    };
    const configRepo = {
      findOne: jest.fn().mockResolvedValue(cfg),
      save: jest.fn().mockImplementation((c) => Promise.resolve(c)),
    };
    const service = new AiService(
      configRepo as never,
      null as never,
      null as never,
      null as never,
      { execute: jest.fn() } as never,
      null as never,
    );
    const admin: ReqUser = { userId: 'a', email: 'admin@b.com', role: 'Admin' };
    const out1 = await service.setConfig(admin, { knowledge: '  Hola mundo  ' });
    expect(out1.knowledge).toBe('Hola mundo');
    const out2 = await service.setConfig(admin, { knowledge: '   ' });
    expect(out2.knowledge).toBe('');
  });
});
