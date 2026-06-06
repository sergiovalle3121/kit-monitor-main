import type { ColumnOptions } from 'typeorm';

/**
 * Decimal <-> number transformer so money columns come back as JS numbers
 * (Postgres returns DECIMAL as string by default). Mirrors the convention
 * used by the existing accounting module.
 */
export const decimalToNumber = {
  to: (value: number | null | undefined) => value ?? 0,
  from: (value: string | number | null) => Number(value ?? 0),
};

/** Reusable money/decimal column options. Amounts use scale 4, unit costs scale 6. */
export const money = (scale = 4): ColumnOptions => ({
  type: 'decimal',
  precision: 18,
  scale,
  default: 0,
  transformer: decimalToNumber,
});
