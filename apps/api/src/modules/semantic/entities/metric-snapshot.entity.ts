import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';

/**
 * A point-in-time snapshot of a metric's value — the substrate that turns a
 * point-in-time KPI into a **time series** (so the Intelligence Center can show
 * whether a KPI is improving, not just its current number). Captured daily by a
 * scheduled job (idempotent per tenant+metric+day). Additive, prefixed table.
 */
@Entity('sem_metric_snapshot')
@Index(['tenantId', 'metricKey', 'day'])
export class MetricSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64, default: '__default__' })
  tenantId: string;

  @Column({ type: 'varchar', length: 64 })
  metricKey: string;

  /** The resolved numeric value at capture time. */
  @Column({ type: 'float', nullable: true })
  value: number | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  unit: string | null;

  /** YYYY-MM-DD bucket for idempotent daily capture and trend plotting. */
  @Column({ type: 'varchar', length: 10 })
  day: string;

  @CreateDateColumn({ type: DATE_COLUMN_TYPE })
  capturedAt: Date;
}
