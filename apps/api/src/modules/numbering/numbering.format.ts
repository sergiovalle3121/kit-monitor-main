/**
 * Pure, side-effect-free helpers for document-number formatting.
 *
 * Kept separate from the service so the formatting / reset rules can be unit
 * tested in isolation (no DB, no DI). Every module in AXOS (WO, PO, NCR, ASN…)
 * ultimately renders its folio through {@link formatDocumentNumber}.
 */

export type ResetPolicy = 'NEVER' | 'YEARLY' | 'MONTHLY';

export const RESET_POLICIES: ResetPolicy[] = ['NEVER', 'YEARLY', 'MONTHLY'];

/** Tokens understood inside a sequence `pattern`. */
export const KNOWN_TOKENS = ['PREFIX', 'YYYY', 'YY', 'MM', 'DD', 'SEQ'] as const;
export type Token = (typeof KNOWN_TOKENS)[number];

export interface FormatInput {
  /** Template, e.g. `'{PREFIX}-{YYYY}-{SEQ}'`. Must contain `{SEQ}`. */
  pattern: string;
  /** Short prefix, e.g. `'WO'`. */
  prefix: string;
  /** The numeric value to render for `{SEQ}`. */
  seq: number;
  /** Zero-pad width applied to `{SEQ}`. */
  padding: number;
  /** Reference date for date tokens (defaults to now). */
  date?: Date;
}

/** Left-pads a non-negative integer to at least `width` digits. */
export function pad(value: number, width: number): string {
  const digits = Math.trunc(Math.abs(value)).toString();
  const w = Math.max(1, Math.trunc(width || 1));
  return digits.length >= w ? digits : '0'.repeat(w - digits.length) + digits;
}

/**
 * Renders a folio string by substituting tokens in `pattern`. Unknown tokens
 * are left untouched (so a typo is visible rather than silently dropped).
 */
export function formatDocumentNumber(input: FormatInput): string {
  const date = input.date ?? new Date();
  const yyyy = pad(date.getFullYear(), 4);
  const tokens: Record<Token, string> = {
    PREFIX: input.prefix ?? '',
    YYYY: yyyy,
    YY: yyyy.slice(-2),
    MM: pad(date.getMonth() + 1, 2),
    DD: pad(date.getDate(), 2),
    SEQ: pad(input.seq, input.padding),
  };
  return input.pattern.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in tokens ? tokens[key as Token] : match,
  );
}

/**
 * The "period key" identifying the current reset window for a policy.
 * `NEVER → null`, `YEARLY → 'YYYY'`, `MONTHLY → 'YYYY-MM'`.
 * When the stored key differs from this, the counter resets to 1.
 */
export function computePeriodKey(
  policy: ResetPolicy,
  date: Date = new Date(),
): string | null {
  const yyyy = pad(date.getFullYear(), 4);
  switch (policy) {
    case 'YEARLY':
      return yyyy;
    case 'MONTHLY':
      return `${yyyy}-${pad(date.getMonth() + 1, 2)}`;
    case 'NEVER':
    default:
      return null;
  }
}

export interface PatternValidation {
  valid: boolean;
  error?: string;
}

/** Validates a pattern: must contain `{SEQ}` and only known tokens. */
export function validatePattern(pattern: string): PatternValidation {
  if (!pattern || typeof pattern !== 'string') {
    return { valid: false, error: 'El patrón es obligatorio.' };
  }
  if (!pattern.includes('{SEQ}')) {
    return { valid: false, error: 'El patrón debe incluir el token {SEQ}.' };
  }
  const used = [...pattern.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  const unknown = used.filter((t) => !KNOWN_TOKENS.includes(t as Token));
  if (unknown.length > 0) {
    return {
      valid: false,
      error: `Tokens desconocidos: ${unknown.join(', ')}. Permitidos: ${KNOWN_TOKENS.map((t) => `{${t}}`).join(', ')}.`,
    };
  }
  return { valid: true };
}

export function isResetPolicy(value: unknown): value is ResetPolicy {
  return typeof value === 'string' && RESET_POLICIES.includes(value as ResetPolicy);
}
