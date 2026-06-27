import { ServiceUnavailableException } from '@nestjs/common';
import { AiService } from './ai.service';
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
