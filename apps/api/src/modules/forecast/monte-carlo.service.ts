import { Injectable } from '@nestjs/common';
import {
  HistoricalDataPoint,
  PercentileProjection,
  SimulationOutput,
  SimulationParams,
} from './entities/forecast.entity';

const DEFAULT_PARAMS: Required<SimulationParams> = {
  iterations: 1000,
  periods: 12,
  periodUnit: 'week',
  confidenceLevels: [10, 50, 90],
  distribution: 'normal',
};

@Injectable()
export class MonteCarloService {
  run(
    inputData: HistoricalDataPoint[],
    rawParams?: Partial<SimulationParams> | null,
  ): SimulationOutput {
    const start = Date.now();
    const params: Required<SimulationParams> = {
      ...DEFAULT_PARAMS,
      ...rawParams,
    };

    const values = inputData.map((d) => d.value);
    const stats = this.computeStats(values);

    // Build matrix [iterations × periods] of sampled values
    const matrix = this.buildSampleMatrix(stats, params);

    const projections = this.buildProjections(matrix, params, inputData);

    return {
      projections,
      stats: {
        historicalMean: stats.mean,
        historicalStdDev: stats.stdDev,
        historicalMin: stats.min,
        historicalMax: stats.max,
        sampleSize: values.length,
      },
      executedAt: new Date().toISOString(),
      durationMs: Date.now() - start,
    };
  }

  // ── Stats ───────────────────────────────────────────────────────────────

  private computeStats(values: number[]) {
    const n = values.length;
    const mean = values.reduce((s, v) => s + v, 0) / n;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
    const stdDev = Math.sqrt(variance);
    return {
      mean,
      stdDev,
      min: Math.min(...values),
      max: Math.max(...values),
    };
  }

  // ── Sampling ────────────────────────────────────────────────────────────

  private buildSampleMatrix(
    stats: ReturnType<MonteCarloService['computeStats']>,
    params: Required<SimulationParams>,
  ): number[][] {
    const { iterations, periods, distribution } = params;
    const matrix: number[][] = [];

    for (let i = 0; i < iterations; i++) {
      const row: number[] = [];
      for (let p = 0; p < periods; p++) {
        const raw =
          distribution === 'lognormal'
            ? this.sampleLognormal(stats.mean, stats.stdDev)
            : this.sampleNormal(stats.mean, stats.stdDev);
        row.push(Math.max(0, raw)); // production cannot be negative
      }
      matrix.push(row);
    }
    return matrix;
  }

  // Box-Muller transform — no external dependency needed.
  private sampleNormal(mean: number, stdDev: number): number {
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z * stdDev;
  }

  private sampleLognormal(mean: number, stdDev: number): number {
    // Convert normal parameters to lognormal parameters (method-of-moments)
    const variance = stdDev ** 2;
    const mu = Math.log(mean ** 2 / Math.sqrt(mean ** 2 + variance));
    const sigma = Math.sqrt(Math.log(1 + variance / mean ** 2));
    return Math.exp(this.sampleNormal(mu, sigma));
  }

  // ── Projections ─────────────────────────────────────────────────────────

  private buildProjections(
    matrix: number[][],
    params: Required<SimulationParams>,
    inputData: HistoricalDataPoint[],
  ): PercentileProjection[] {
    const { periods } = params;
    const projections: PercentileProjection[] = [];

    const lastDate =
      inputData.length > 0
        ? new Date(inputData[inputData.length - 1].date)
        : new Date();

    for (let p = 0; p < periods; p++) {
      const column = matrix.map((row) => row[p]).sort((a, b) => a - b);
      const mean = column.reduce((s, v) => s + v, 0) / column.length;

      projections.push({
        period: p + 1,
        periodLabel: this.periodLabel(lastDate, p + 1, params.periodUnit),
        mean: this.round(mean),
        p10: this.round(this.percentile(column, 10)),
        p50: this.round(this.percentile(column, 50)),
        p90: this.round(this.percentile(column, 90)),
        min: this.round(column[0]),
        max: this.round(column[column.length - 1]),
      });
    }
    return projections;
  }

  private percentile(sorted: number[], p: number): number {
    const idx = (p / 100) * (sorted.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  }

  private periodLabel(
    base: Date,
    offset: number,
    unit: 'day' | 'week' | 'month',
  ): string {
    const d = new Date(base);
    if (unit === 'day') d.setDate(d.getDate() + offset);
    else if (unit === 'week') d.setDate(d.getDate() + offset * 7);
    else d.setMonth(d.getMonth() + offset);
    return d.toISOString().split('T')[0];
  }

  private round(n: number): number {
    return Math.round(n * 100) / 100;
  }
}
