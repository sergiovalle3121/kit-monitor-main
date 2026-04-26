export class BottleneckQueryDto {
  /** Filter by model (e.g. 'XA-220'). Required for graph construction. */
  model: string;

  /** Optional: restrict analysis to a specific work-order / kit ID */
  kitId?: number;

  /**
   * Analysis window in minutes (default: last 60 minutes of bay events).
   * Wider windows smooth out transient spikes; narrower windows capture live state.
   */
  windowMinutes?: number;
}

export class BayNodeDto {
  bayId: number;
  /** Observed throughput: total units recorded in analysis window */
  observedUnits: number;
  /** Theoretical throughput: units per window derived from BOM + BayLayout */
  theoreticalCapacity: number;
  /** observedUnits / theoreticalCapacity (0.0 – ∞, >1 = overachieving) */
  efficiency: number;
  /** Number of raw bay events in the window */
  eventCount: number;
  /**
   * Operational state derived from graph flow analysis:
   *   normal     — throughput within ±20 % of theoretical
   *   bottleneck — throughput significantly below theoretical AND below neighbours
   *   starvation — input starvation: upstream bay throughput << this bay capacity
   *   blocking   — downstream blocking: downstream bay throughput << this bay throughput
   */
  state: 'normal' | 'bottleneck' | 'starvation' | 'blocking';
}

export class HotspotDto {
  bayId: number;
  type: 'bottleneck' | 'starvation' | 'blocking';
  /** Normalised severity 0.0 (marginal) → 1.0 (critical) */
  severityScore: number;
  observedUnits: number;
  theoreticalCapacity: number;
  /** Units per window that are being "lost" to the constraint */
  efficiencyGap: number;
  recommendation: string;
}

export class BottleneckReportDto {
  model: string;
  kitId?: number;
  windowMinutes: number;
  analyzedAt: Date;
  bayCount: number;
  bayNodes: BayNodeDto[];
  hotspots: HotspotDto[];
  overallFlowEfficiency: number; // avg efficiency across all bays
  criticalHotspot: HotspotDto | null;
}
