import { RawStreamChunk, StreamAssembler } from './cide-provider';

describe('StreamAssembler', () => {
  it('concatenates content deltas and forwards each fragment', () => {
    const a = new StreamAssembler();
    const seen: string[] = [];
    const chunks: RawStreamChunk[] = [
      { choices: [{ delta: { content: 'Todo ' } }] },
      { choices: [{ delta: { content: 'va ' } }] },
      { choices: [{ delta: { content: 'bien.' } }] },
    ];
    for (const c of chunks) a.push(c, (t) => seen.push(t));
    const out = a.finish();
    expect(seen).toEqual(['Todo ', 'va ', 'bien.']);
    expect(out.content).toBe('Todo va bien.');
    expect(out.toolCalls).toEqual([]);
  });

  it('reassembles a tool call whose arguments arrive split across chunks', () => {
    const a = new StreamAssembler();
    const chunks: RawStreamChunk[] = [
      {
        choices: [
          {
            delta: {
              tool_calls: [
                { index: 0, id: 'call_1', function: { name: 'operations_pulse' } },
              ],
            },
          },
        ],
      },
      {
        choices: [
          { delta: { tool_calls: [{ index: 0, function: { arguments: '{"sin' } }] } },
        ],
      },
      {
        choices: [
          {
            delta: { tool_calls: [{ index: 0, function: { arguments: 'ce":7}' } }] },
          },
        ],
      },
    ];
    for (const c of chunks) a.push(c);
    const out = a.finish();
    expect(out.content).toBe('');
    expect(out.toolCalls).toEqual([
      { id: 'call_1', name: 'operations_pulse', arguments: { since: 7 } },
    ]);
  });

  it('captures usage from the final chunk and orders multiple tool calls', () => {
    const a = new StreamAssembler();
    a.push({
      choices: [
        {
          delta: {
            tool_calls: [
              { index: 1, id: 'b', function: { name: 'two', arguments: '{}' } },
              { index: 0, id: 'a', function: { name: 'one', arguments: '{}' } },
            ],
          },
        },
      ],
    });
    a.push({
      choices: [{ delta: {}, finish_reason: 'stop' }],
      usage: { prompt_tokens: 120, completion_tokens: 34 },
    });
    const out = a.finish();
    expect(out.toolCalls.map((t) => t.name)).toEqual(['one', 'two']);
    expect(out.usage).toEqual({ inputTokens: 120, outputTokens: 34 });
  });

  it('tolerates malformed tool-call arguments (returns empty object)', () => {
    const a = new StreamAssembler();
    a.push({
      choices: [
        {
          delta: {
            tool_calls: [
              { index: 0, id: 'x', function: { name: 'broken', arguments: '{not json' } },
            ],
          },
        },
      ],
    });
    expect(a.finish().toolCalls[0]).toEqual({
      id: 'x',
      name: 'broken',
      arguments: {},
    });
  });
});
