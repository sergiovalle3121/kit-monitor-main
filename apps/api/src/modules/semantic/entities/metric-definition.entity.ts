import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { JSON_COLUMN_TYPE } from '../../../common/database/json-column-type';

/**
 * A versioned KPI definition in the semantic layer — the single source of truth
 * for what a metric *means* (its name, unit, grain and formula), independent of
 * any one screen. This is the MicroStrategy-style "fact/metric catalog": define
 * a metric once, reference it everywhere (dashboards, CIDE, reports).
 *
 * `resolver` optionally links the definition to a live computation (see the
 * resolver registry in SemanticService) so the catalog can show a current value,
 * not just a description. Tenant-scoped; seeded with a permissive baseline.
 */
@Entity('sem_metric_definition')
@Index(['tenantId', 'key'])
export class MetricDefinition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64, default: '__default__' })
  tenantId: string;

  /** Stable machine key, e.g. `inventory_value`. */
  @Column({ type: 'varchar', length: 64 })
  key: string;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** Display unit: `USD`, `count`, `%`, `units`, `h`… */
  @Column({ type: 'varchar', length: 32, nullable: true })
  unit: string | null;

  /** Business domain: MATERIALS, PRODUCTION, QUALITY, FINANCE, SALES, SYSTEM… */
  @Column({ type: 'varchar', length: 32, nullable: true })
  domain: string | null;

  /** Aggregation grain, e.g. `plant`, `line`, `work_order`, `part`. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  grain: string | null;

  /** Human-readable definition/formula of how the metric is computed. */
  @Column({ type: 'text', nullable: true })
  formula: string | null;

  /** Key into the live resolver registry (null = definition-only). */
  @Column({ type: 'varchar', length: 64, nullable: true })
  resolver: string | null;

  /** Whether higher is better (`up`) or worse (`down`). */
  @Column({ type: 'varchar', length: 8, nullable: true })
  direction: string | null;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ default: true })
  active: boolean;

  /** Optional extra config (e.g. `{ target }`); kept as JSON to stay portable. */
  @Column({ type: JSON_COLUMN_TYPE, nullable: true })
  config: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
