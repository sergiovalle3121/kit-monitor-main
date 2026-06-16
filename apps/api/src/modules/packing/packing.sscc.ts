// ─────────────────────────────────────────────────────────────────────────────
// SSCC (Serial Shipping Container Code, GS1) — pure builder + validator. An SSCC
// is 18 digits: extension(1) + GS1 company prefix(N) + serial reference(16−N) +
// mod-10 check digit(1). Side-effect free so the service and specs share one
// truth. The real GS1 company prefix is configured (env GS1_COMPANY_PREFIX); a
// placeholder is flagged honestly until the company's prefix is set.
// ─────────────────────────────────────────────────────────────────────────────

/** Placeholder GS1 company prefix used until a real one is configured. */
export const PLACEHOLDER_PREFIX = "0000000"; // 7 digits

/** GS1 mod-10 check digit over a 17-digit string (weights 3,1,… from the right). */
export function ssccCheckDigit(d17: string): number {
  if (!/^\d{17}$/.test(d17)) {
    throw new Error("SSCC base must be exactly 17 digits.");
  }
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const digit = Number(d17[16 - i]); // from the right
    sum += digit * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

/** Validate a full 18-digit SSCC (length + check digit). */
export function isValidSscc(sscc: string): boolean {
  if (!/^\d{18}$/.test(sscc)) return false;
  return ssccCheckDigit(sscc.slice(0, 17)) === Number(sscc[17]);
}

/** Normalize a configured company prefix to digits (fallback to placeholder). */
export function normalizePrefix(prefix?: string | null): { prefix: string; placeholder: boolean } {
  const digits = (prefix ?? "").replace(/\D/g, "");
  // A real GS1 company prefix is 6–10 digits and not all zeros (all-zeros is the
  // placeholder we use until the company's prefix is configured).
  if (digits.length >= 6 && digits.length <= 10 && !/^0+$/.test(digits)) {
    return { prefix: digits, placeholder: false };
  }
  return { prefix: PLACEHOLDER_PREFIX, placeholder: true };
}

export interface BuiltSscc {
  sscc: string;
  placeholder: boolean;
}

/**
 * Build an 18-digit SSCC from a company prefix + a numeric serial reference.
 * extension defaults to '0'. The serial is zero-padded (or right-truncated) to
 * fill the 17-digit base. Returns `placeholder: true` when no real GS1 prefix is
 * configured, so the UI can warn the operator.
 */
export function buildSscc(
  companyPrefix: string | null | undefined,
  serial: number,
  extension = "0",
): BuiltSscc {
  const ext = (extension ?? "0").replace(/\D/g, "").slice(0, 1) || "0";
  const { prefix, placeholder } = normalizePrefix(companyPrefix);
  const serialWidth = 17 - ext.length - prefix.length; // digits left for the serial
  if (serialWidth < 1) throw new Error("Company prefix too long for an SSCC serial.");
  const serialStr = String(Math.max(0, Math.trunc(serial)))
    .padStart(serialWidth, "0")
    .slice(-serialWidth);
  const base17 = `${ext}${prefix}${serialStr}`;
  const sscc = base17 + ssccCheckDigit(base17);
  return { sscc, placeholder };
}

/** Human-readable SSCC grouped as the GS1 AI element string "(00) ssscc". */
export function ssccElementString(sscc: string): string {
  return `(00) ${sscc}`;
}
