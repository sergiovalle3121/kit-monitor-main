/**
 * CIDE provider — the self-hosted inference client.
 *
 * CIDE ("Cognitive Intelligence & Decision Engine") is Axos OS's own AI. It does
 * NOT call any external AI vendor (no Anthropic, no DeepSeek, no OpenAI cloud).
 * Instead it talks to an **OpenAI-compatible** inference server that the
 * operator runs and controls — Ollama, vLLM, llama.cpp, TGI — serving an
 * open-weight model. The whole conversation, and all grounded business data,
 * stays inside your own infrastructure.
 *
 * This is a tiny, dependency-free client (Node 20+ global `fetch`) that speaks
 * the Chat Completions API with function/tool calling. Swapping the engine (CPU
 * Ollama in dev → a GPU vLLM cluster in prod) is purely a `CIDE_BASE_URL`
 * change; no code change.
 */

/** A tool offered to the model (OpenAI `function` shape, JSON-Schema params). */
export interface CideToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/** A tool invocation the model asked for, with parsed arguments. */
export interface CideToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/** A chat message in the OpenAI-compatible wire format. */
export interface CideMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

export interface CideUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface CideCompletion {
  content: string;
  toolCalls: CideToolCall[];
  usage: CideUsage;
}

export interface CideProviderOptions {
  /** Base URL of the OpenAI-compatible server, e.g. http://localhost:11434/v1 */
  baseUrl: string;
  /** Model tag to serve, e.g. "qwen2.5:7b". */
  model: string;
  /** Optional bearer token (local engines like Ollama need none). */
  apiKey?: string | null;
  /** Per-request timeout. Local models can be slow on CPU. */
  timeoutMs?: number;
}

interface ChatArgs {
  messages: CideMessage[];
  tools?: CideToolSpec[];
  maxTokens: number;
  temperature?: number;
}

/** Shape of the OpenAI-compatible chat completion response we rely on. */
interface RawCompletion {
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: Array<{
        id?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export class CideEngineError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'CideEngineError';
  }
}

export class CideProvider {
  private readonly endpoint: string;
  private readonly model: string;
  private readonly apiKey: string | null;
  private readonly timeoutMs: number;

  constructor(opts: CideProviderOptions) {
    this.endpoint = `${opts.baseUrl.replace(/\/+$/, '')}/chat/completions`;
    this.model = opts.model;
    this.apiKey = opts.apiKey?.trim() || null;
    this.timeoutMs = opts.timeoutMs ?? 120_000;
  }

  /** One model turn. Returns the assistant text and any tool calls it requested. */
  async chat(args: ChatArgs): Promise<CideCompletion> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages: args.messages,
      max_tokens: args.maxTokens,
      temperature: args.temperature ?? 0.2,
      stream: false,
    };
    if (args.tools && args.tools.length > 0) {
      body.tools = args.tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
      body.tool_choice = 'auto';
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      throw new CideEngineError(
        `No se pudo contactar al motor de CIDE en ${this.endpoint}: ${reason}`,
      );
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new CideEngineError(
        `El motor de CIDE respondió ${res.status}: ${text.slice(0, 500)}`,
        res.status,
      );
    }

    const data = (await res.json()) as RawCompletion;
    const msg = data.choices?.[0]?.message ?? {};
    const toolCalls: CideToolCall[] = (msg.tool_calls ?? [])
      .filter((tc) => tc.function?.name)
      .map((tc, i) => ({
        id: tc.id || `call_${i}`,
        name: tc.function!.name as string,
        arguments: parseArgs(tc.function?.arguments),
      }));

    return {
      content: (msg.content ?? '').trim(),
      toolCalls,
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
      },
    };
  }
}

/** Tool-call arguments arrive as a JSON string; tolerate malformed output. */
function parseArgs(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
