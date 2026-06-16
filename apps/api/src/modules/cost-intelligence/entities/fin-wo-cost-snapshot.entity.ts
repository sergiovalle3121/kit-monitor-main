import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';

/**
 * Frozen period-close costing snapshot for a work order (Block M — cost
 * intelligence). COGS and material-usage variance are computed live from the
 * floor (backflush consumption + line routing + quality holds) and standard
 * cost; at period close a snapshot is written so the historical figure never
 * moves again — later confirmations or master-data changes do not re-cost a
 * closed period ("no recalcular histórico").
 *
 * 100% additive: brand-new table, prefixed `fin_` to avoid colliding with the
 * legacy `cost_items` / accounting tables; every column nullable or defaulted.
 * Money is `double precision` (DECISIONS §4): management/reporting figures.
 */
@Entity('fin_wo_cost_snapshot')
@Index('idx_fin_wo_cost_scope_period', ['tenant_id', 'plant_id', 'period'])
@Index('idx_fin_wo_cost_program', ['programId', 'period'])
export class FinWoCostSnapshot extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Accounting period the snapshot closes, `YYYY-MM`. */
  @Index()
  @Column({ type: 'varchar', length: 7 })
  period: string;

  @Index()
  @Column({ type: 'varchar', length: 36, name: 'wo_id' })
  woId: string;

  @Column({ type: 'varchar', length: 32, nullable: true, name: 'wo_folio' })
  woFolio: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  model: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  line: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true, name: 'program_id' })
  programId: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  customer: string | null;

  /** WO status at the moment of close. */
  @Column({ type: 'varchar', length: 16, nullable: true, name: 'wo_status' })
  woStatus: string | null;

  @Column({ type: 'int', default: 0, name: 'quantity_planned' })
  quantityPlanned: number;

  @Column({ type: 'int', default: 0, name: 'quantity_completed' })
  quantityCompleted: number;

  // ── Material (plan = BOM rollup × qty; actual = backflush) ──────────────────
  @Column({ type: 'float', default: 0, name: 'material_plan_cost' })
  materialPlanCost: number;

  @Column({ type: 'float', default: 0, name: 'material_actual_cost' })
  materialActualCost: number;

  @Column({ type: 'float', default: 0, name: 'material_usage_variance' })
  materialUsageVariance: number;

  // ── Conversion ──────────────────────────────────────────────────────────────
  @Column({ type: 'float', default: 0, name: 'labor_cost' })
  laborCost: number;

  @Column({ type: 'float', default: 0, name: 'overhead_cost' })
  overheadCost: number;

  // ── Scrap (from quality holds / NCR) ────────────────────────────────────────
  @Column({ type: 'float', default: 0, name: 'scrap_qty' })
  scrapQty: number;

  @Column({ type: 'float', default: 0, name: 'scrap_cost' })
  scrapCost: number;

  // ── Totals ────────────────────────────────────────────────────────────────
  @Column({ type: 'float', default: 0 })
  cogs: number;

  @Column({ type: 'float', default: 0, name: 'unit_cost' })
  unitCost: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  // ── Parameters used (so the frozen figure is reproducible / auditable) ──────
  @Column({ type: 'float', default: 0, name: 'labor_rate' })
  laborRate: number;

  @Column({ type: 'float', default: 0, name: 'overhead_rate' })
  overheadRate: number;

  @Column({ type: 'varchar', length: 24, nullable: true, name: 'labor_source' })
  laborSource: string | null;

  @Column({ type: 'varchar', length: 24, nullable: true, name: 'overhead_source' })
  overheadSource: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'closed_by' })
  closedBy: string | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'closed_at' })
  closedAt: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes: string | null;
}
