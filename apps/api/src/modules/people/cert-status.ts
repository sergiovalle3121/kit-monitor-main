/**
 * Pure helpers for deriving a certification's live status from its expiry date.
 * Kept separate so the date logic is unit-tested in isolation.
 */

export type CertStatus = 'VALID' | 'EXPIRING' | 'EXPIRED' | 'NO_EXPIRY';

const DAY = 86_400_000;

export function daysToExpiry(
  expiresDate: Date | string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!expiresDate) return null;
  return Math.floor((new Date(expiresDate).getTime() - now.getTime()) / DAY);
}

export function certStatus(
  expiresDate: Date | string | null | undefined,
  now: Date = new Date(),
  warnDays = 30,
): CertStatus {
  if (!expiresDate) return 'NO_EXPIRY';
  const d = daysToExpiry(expiresDate, now);
  if (d === null) return 'NO_EXPIRY';
  if (d < 0) return 'EXPIRED';
  if (d <= warnDays) return 'EXPIRING';
  return 'VALID';
}
