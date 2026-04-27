/**
 * Statistical Process Control (SPC) result DTOs.
 *
 * A StabilityReport describes the process stability of a production line or
 * bay based on cycle-time analysis of LedgerEvent history. The Sigma Level
 * maps directly to Six Sigma process capability language (e.g. 2.4σ, 3.1σ).
 */

export class BayStabilityDto {
  /** Bay identifier (1–6) */
  bayId: number;

  /** Mean cycle time or throughput metric across the sample window */
  mean: number;

  /** Sample standard deviation (σ) */
  stdDev: number;

  /**
   * Sigma level = mean / stdDev (simplified SPC capability).
   * A higher value = more stable. Six-sigma baseline = 6.0.
   */
  sigmaLevel: number;

  /** Total sample size used for the computation */
  sampleCount: number;

  /** Events outside the 3-sigma control limits (Out-of-Control points) */
  outOfControlCount: number;

  /** Upper Control Limit = mean + 3 × stdDev */
  ucl: number;

  /** Lower Control Limit = mean − 3 × stdDev (floored at 0 for quantity metrics) */
  lcl: number;

  /**
   * Z-Score of the most recent data point relative to the process mean.
   * |z| > 3 → out-of-control signal.
   */
  latestZScore: number | null;
}

export type ProcessCapability = 'excellent' | 'good' | 'acceptable' | 'marginal' | 'poor' | 'critical';

export class StabilityReportDto {
  /** Scope identifiers (nullable if analysing plant-wide) */
  line?:  string;
  model?: string;

  /**
   * Overall Sigma Level for the scope.
   * Computed as the average sigmaLevel across all sampled bays.
   * Industry interpretation:
   *   ≥ 6.0 → World-class
   *   ≥ 4.5 → excellent
   *   ≥ 3.0 → good
   *   ≥ 2.0 → acceptable
   *   ≥ 1.5 → marginal
   *   < 1.5 → poor / critical
   */
  sigmaLevel: number;

  /** Population mean across all events in scope */
  mean: number;

  /** Population standard deviation */
  stdDev: number;

  /** Total events analysed */
  totalEvents: number;

  /** Events flagged as out-of-control (|Z-score| > 3) */
  outOfControlCount: number;

  /** Fraction of out-of-control events (0.0 – 1.0) */
  outOfControlPct: number;

  /** Human-readable process capability label derived from sigmaLevel */
  processCapability: ProcessCapability;

  /** Control limits for the aggregated process */
  ucl: number; // mean + 3σ
  lcl: number; // mean − 3σ

  /** Per-bay breakdowns */
  bayBreakdowns: BayStabilityDto[];

  generatedAt: Date;
}
