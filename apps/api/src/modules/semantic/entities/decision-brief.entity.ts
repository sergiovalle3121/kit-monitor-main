import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { JSON_COLUMN_TYPE } from '../../../common/database/json-column-type';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';

/** One KPI line inside a brief: current value + recent change. */
export interface BriefMetricRow {
  key: string;
  name: string;
  value: number;
  unit: string | null;
  domain: string | null;
  /** % change over the trailing window, or null if not enough history. */
  deltaPct: number | null;
  direction: string | null;
  /** Whether the change is favorable given the metric's direction (null = unknown). */
  good: boolean | null;
}

/** A condensed alert inside a brief. */
export interface BriefAlertRow {
  name: string;
  severity: 'warning' | 'critical';
  kind: 'target' | 'trend';
  message: string;
}

/**
 * A **Decision Brief** — a deterministic, periodic executive summary that
 * synthesizes a tenant's KPI values, their recent movement and active alerts
 * into a durable, reviewable artifact. Generated daily by a scheduled job (one
 * per tenant per day, refreshed in place) and on demand by an admin. Unlike a
 * chat answer it persists, so a decision and the data behind it stay on record.
 * Additive, prefixed table.
 */
@Entity('sem_decision_brief')
@Index(['tenantId', 'periodKey'])
export class DecisionBrief {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64, default: '__default__' })
  tenantId: string;

  /** YYYY-MM-DD bucket; one brief per tenant per day (refreshed in place). */
  @Column({ type: 'varchar', length: 10 })
  periodKey: string;

  /** One-line takeaway for scanning. */
  @Column({ type: 'varchar', length: 240 })
  headline: string;

  /** A few sentences of deterministic narrative grounded in the data. */
  @Column({ type: 'text' })
  summary: string;

  /** Snapshot of the headline KPIs and their movement at generation time. */
  @Column({ type: JSON_COLUMN_TYPE, nullable: true })
  metrics: BriefMetricRow[] | null;

  /** Condensed list of the active KPI alerts at generation time. */
  @Column({ type: JSON_COLUMN_TYPE, nullable: true })
  alerts: BriefAlertRow[] | null;

  @Column({ type: 'int', default: 0 })
  alertsCount: number;

  @Column({ type: 'int', default: 0 })
  criticalCount: number;

  @CreateDateColumn({ type: DATE_COLUMN_TYPE })
  createdAt: Date;
}
