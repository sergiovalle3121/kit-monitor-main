/**
 * CIDE model catalog + cost estimation for usage metering.
 *
 * CIDE runs on a **self-hosted, open-weight** model served through an
 * OpenAI-compatible endpoint (Ollama / vLLM / llama.cpp) that the operator
 * controls — no external AI provider, no per-token billing. Because inference
 * runs on your own infrastructure, the marginal **cost per token is $0**; the
 * prices below are therefore zero. Token counts are still metered (in
 * `ai_usage_log`) as a capacity/usage signal and to drive the monthly usage
 * guardrail, not an invoice.
 *
 * All default models are **Apache-2.0** licensed (Qwen2.5 / Mistral), which
 * satisfies the repo's permissive-only policy (see THIRD_PARTY_NOTICES.md).
 */
export interface ModelPrice {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

/** USD per 1,000,000 tokens. Self-hosted ⇒ $0; kept for the metering interface. */
const FREE: ModelPrice = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

/**
 * Open-weight models CIDE can run. Keys are the model tags passed straight to
 * the inference engine (e.g. an Ollama tag or a vLLM `--served-model-name`).
 * Keep every entry permissively licensed (Apache-2.0 / MIT / BSD).
 */
export const MODEL_PRICES: Record<string, ModelPrice> = {
  // Qwen2.5 Instruct — Apache-2.0. Strong tool-use + excellent Spanish.
  'qwen2.5:7b': FREE, // default: runs on CPU or a small GPU
  'qwen2.5:14b': FREE, // stronger reasoning, needs a GPU
  'qwen2.5:32b': FREE, // escalation tier, heavy reasoning (GPU)
  // Mistral 7B Instruct — Apache-2.0. Lightweight alternative.
  'mistral:7b': FREE,
};

/** Cheap, CPU-capable default for routine grounded queries. */
export const DEFAULT_MODEL = 'qwen2.5:7b';
/** High-capability tier for hard reasoning, used on demand (GPU recommended). */
export const ESCALATION_MODEL = 'qwen2.5:32b';
export const ALLOWED_MODELS = Object.keys(MODEL_PRICES);

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export function emptyUsage(): TokenUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  };
}

/**
 * Estimated USD cost of a turn. Self-hosted inference is $0/token, so this is
 * 0 by design; the function is retained so the metering pipeline (and the admin
 * usage view) keep a stable shape if a paid model is ever wired in.
 */
export function estimateCostUsd(model: string, u: TokenUsage): number {
  const p = MODEL_PRICES[model] ?? MODEL_PRICES[DEFAULT_MODEL];
  return (
    (u.inputTokens * p.input +
      u.outputTokens * p.output +
      u.cacheReadTokens * p.cacheRead +
      u.cacheWriteTokens * p.cacheWrite) /
    1_000_000
  );
}

/** Total tokens that count against a tenant's monthly usage guardrail. */
export function billableTokens(u: TokenUsage): number {
  return (
    u.inputTokens + u.outputTokens + u.cacheReadTokens + u.cacheWriteTokens
  );
}
