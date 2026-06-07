/**
 * Pure straight-line depreciation helpers (Fixed Assets / FIN).
 * Kept separate so the math is unit-tested in isolation.
 */

export interface DepreciableAsset {
  acquisitionCost: number;
  salvageValue: number;
  usefulLifeMonths: number;
  acquisitionDate: Date | string | null;
}

/** Months elapsed between two dates (whole months, floored, never negative). */
export function monthsBetween(
  from: Date | string | null | undefined,
  to: Date = new Date(),
): number {
  if (!from) return 0;
  const f = new Date(from);
  let months =
    (to.getFullYear() - f.getFullYear()) * 12 + (to.getMonth() - f.getMonth());
  if (to.getDate() < f.getDate()) months -= 1; // not a full month yet
  return Math.max(0, months);
}

/** Straight-line depreciation per month = (cost − salvage) / life. */
export function monthlyDepreciation(asset: DepreciableAsset): number {
  const base = Number(asset.acquisitionCost ?? 0) - Number(asset.salvageValue ?? 0);
  const life = Number(asset.usefulLifeMonths ?? 0);
  if (life <= 0 || base <= 0) return 0;
  return base / life;
}

/** Accumulated depreciation as of a date, capped at (cost − salvage). */
export function accumulatedDepreciation(
  asset: DepreciableAsset,
  asOf: Date = new Date(),
): number {
  const perMonth = monthlyDepreciation(asset);
  if (perMonth <= 0) return 0;
  const elapsed = monthsBetween(asset.acquisitionDate, asOf);
  const cap = Number(asset.acquisitionCost ?? 0) - Number(asset.salvageValue ?? 0);
  return Math.min(cap, Math.round(perMonth * elapsed * 100) / 100);
}

/** Net book value = cost − accumulated depreciation. */
export function bookValue(
  asset: DepreciableAsset,
  asOf: Date = new Date(),
): number {
  const acc = accumulatedDepreciation(asset, asOf);
  return Math.round((Number(asset.acquisitionCost ?? 0) - acc) * 100) / 100;
}
