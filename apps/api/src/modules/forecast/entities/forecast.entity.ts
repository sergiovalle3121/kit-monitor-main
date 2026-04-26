import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { JSON_COLUMN_TYPE } from '../../../common/database/json-column-type';

export enum ForecastStatus {
  DRAFT = 'draft',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

export interface HistoricalDataPoint {
  date: string;   // ISO-8601 date string
  value: number;  // observed quantity (units, hours, etc.)
  label?: string; // optional human-readable label
}

export interface SimulationParams {
  iterations: number;        // Monte Carlo iterations (default 1000)
  periods: number;           // future periods to project (default 12)
  periodUnit: 'day' | 'week' | 'month';
  confidenceLevels: number[]; // e.g. [10, 50, 90]
  distribution: 'normal' | 'lognormal';
}

export interface PercentileProjection {
  period: number;
  periodLabel: string;
  mean: number;
  p10: number;
  p50: number;
  p90: number;
  min: number;
  max: number;
}

export interface SimulationOutput {
  projections: PercentileProjection[];
  stats: {
    historicalMean: number;
    historicalStdDev: number;
    historicalMin: number;
    historicalMax: number;
    sampleSize: number;
  };
  executedAt: string;
  durationMs: number;
}

@Entity('forecasts')
@Index(['tenant_id', 'status'])
@Index(['tenant_id', 'model_id'])
export class Forecast extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 180 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  @Index()
  @Column({ type: 'varchar', length: 100, nullable: true, name: 'model_id' })
  model_id: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: ForecastStatus.DRAFT,
  })
  status: ForecastStatus;

  @Column({ type: JSON_COLUMN_TYPE, nullable: true, name: 'parameters' })
  parameters: SimulationParams | null;

  @Column({ type: JSON_COLUMN_TYPE, nullable: true, name: 'input_data' })
  input_data: HistoricalDataPoint[] | null;

  @Column({ type: JSON_COLUMN_TYPE, nullable: true, name: 'result' })
  result: SimulationOutput | null;

  @Column({ type: 'int', default: 0, name: 'run_count' })
  run_count: number;
}
