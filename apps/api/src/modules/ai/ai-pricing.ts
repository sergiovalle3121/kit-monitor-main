/**
 * Model pricing + cost estimation for usage metering.
 *
 * Prices are USD per 1,000,000 tokens. cacheRead/cacheWrite mirror Anthropic's
 * prompt-caching multipliers (~0.1x input for reads, ~1.25x input for 5-min
 * writes). These figures drive the per-tenant budget and the admin usage view;
 * they are estimates for cost attribution, not an invoice.
 */
export interface ModelPrice {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export const MODEL_PRICES: Record<string, ModelPrice> = {
  'claude-opus-4-8': { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  'claude-opus-4-7': { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  'claude-opus-4-6': { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  'claude-sonnet-4-6': {
    input: 3,
    output: 15,
    cacheRead: 0.3,
    cacheWrite: 3.75,
  },
  'claude-haiku-4-5': { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
};

/** Cheap default for routine grounded queries (user-directed cost control). */
export const DEFAULT_MODEL = 'claude-haiku-4-5';
/** High-capability tier for hard reasoning, used on demand. */
export const ESCALATION_MODEL = 'claude-opus-4-8';
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

/** Total tokens that count against a tenant's monthly budget. */
export function billableTokens(u: TokenUsage): number {
  return (
    u.inputTokens + u.outputTokens + u.cacheReadTokens + u.cacheWriteTokens
  );
}
