import { BadRequestException } from '@nestjs/common';

/**
 * SPC data foundation — pure math + validation helpers.
 *
 * This module is the HONEST numerical core for the SPC roadmap. It only does
 * what is allowed in THIS PR: validate specification limits for a critical
 * characteristic (CTQ) and compute *descriptive* statistics over a set of
 * variable measurements.
 *
 * IMPORTANT (scope guardrail): there are NO control limits, NO Cpk/Ppk and NO
 * out-of-control rules here. Capability indices and control charts consume
 * these measurements in a LATER PR — they are deliberately absent.
 */

export type CharacteristicType = 'VARIABLE' | 'ATTRIBUTE';

export interface SpecLimits {
  nominal?: number | null;
  usl?: number | null;
  lsl?: number | null;
}

export interface SpecLimitsInput extends SpecLimits {
  type?: CharacteristicType | string | null;
}

/**
 * Validate the spec-limit ordering for a VARIABLE characteristic.
 *
 * Only the relationships whose operands are BOTH present are enforced, so a
 * partially specified characteristic (e.g. only an USL) is still accepted:
 *   - USL > LSL
 *   - USL > nominal
 *   - nominal > LSL
 *
 * ATTRIBUTE characteristics carry no numeric window, so validation is skipped.
 * Throws BadRequestException with a clear, user-facing Spanish message.
 */
export function assertSpecLimits(input: SpecLimitsInput): void {
  const type = (input.type ?? 'VARIABLE').toString().toUpperCase();
  if (type === 'ATTRIBUTE') return;

  const nominal = numericOrNull(input.nominal);
  const usl = numericOrNull(input.usl);
  const lsl = numericOrNull(input.lsl);

  if (usl !== null && lsl !== null && !(usl > lsl)) {
    throw new BadRequestException(
      `El límite superior (USL=${usl}) debe ser mayor que el inferior (LSL=${lsl}).`,
    );
  }
  if (usl !== null && nominal !== null && !(usl > nominal)) {
    throw new BadRequestException(
      `El límite superior (USL=${usl}) debe ser mayor que el nominal (${nominal}).`,
    );
  }
  if (nominal !== null && lsl !== null && !(nominal > lsl)) {
    throw new BadRequestException(
      `El nominal (${nominal}) debe ser mayor que el límite inferior (LSL=${lsl}).`,
    );
  }
}

export interface DescriptiveSummary {
  /** Count of finite numeric readings considered. */
  n: number;
  /** Arithmetic mean, or null when there are no readings. */
  mean: number | null;
  /** SAMPLE standard deviation (Bessel's n-1); 0 for n<2; null for n=0. */
  std: number | null;
  min: number | null;
  max: number | null;
  /** Readings strictly below the LSL (only when an LSL is provided). */
  belowLsl: number;
  /** Readings strictly above the USL (only when an USL is provided). */
  aboveUsl: number;
  /** belowLsl + aboveUsl. */
  outOfSpec: number;
  /** Percentage (0..100) of readings out of spec; 0 when n=0. */
  pctOutOfSpec: number;
}

/**
 * Descriptive statistics over a set of VARIABLE readings.
 *
 * - `std` is the SAMPLE standard deviation (divides by n-1) — the spread the
 *   later capability PR will reuse; it is 0 for a single reading and null when
 *   there are no readings.
 * - Out-of-spec is STRICT: a value exactly on a limit is considered in-spec.
 *   Each side is only counted when that limit is actually provided.
 */
export function describeMeasurements(
  values: Array<number | null | undefined>,
  limits: SpecLimits = {},
): DescriptiveSummary {
  const xs = values
    .filter((v) => v !== null && v !== undefined)
    .map((v) => (typeof v === 'number' ? v : Number(v)))
    .filter((v): v is number => Number.isFinite(v));

  const n = xs.length;
  if (n === 0) {
    return {
      n: 0,
      mean: null,
      std: null,
      min: null,
      max: null,
      belowLsl: 0,
      aboveUsl: 0,
      outOfSpec: 0,
      pctOutOfSpec: 0,
    };
  }

  let sum = 0;
  let min = xs[0];
  let max = xs[0];
  for (const x of xs) {
    sum += x;
    if (x < min) min = x;
    if (x > max) max = x;
  }
  const mean = sum / n;

  let std = 0;
  if (n > 1) {
    let ss = 0;
    for (const x of xs) ss += (x - mean) ** 2;
    std = Math.sqrt(ss / (n - 1));
  }

  const usl = numericOrNull(limits.usl);
  const lsl = numericOrNull(limits.lsl);
  let belowLsl = 0;
  let aboveUsl = 0;
  for (const x of xs) {
    if (lsl !== null && x < lsl) belowLsl += 1;
    if (usl !== null && x > usl) aboveUsl += 1;
  }
  const outOfSpec = belowLsl + aboveUsl;

  return {
    n,
    mean,
    std,
    min,
    max,
    belowLsl,
    aboveUsl,
    outOfSpec,
    pctOutOfSpec: (outOfSpec / n) * 100,
  };
}

function numericOrNull(v: number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
