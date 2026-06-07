import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';
import { JSON_COLUMN_TYPE } from '../../../common/database/json-column-type';
import type { WorkOrderStatus } from '../wo-state';

/** How units are counted as produced. */
export type ConsumptionMode = 'BY_UNIT' | 'BY_QTY_FACTOR';
/** Whether each unit needs an individual serial (genealogy) or just a count. */
export type SerialControl = 'NONE' | 'BY_UNIT';

/**
 * A published work order on the production plan (Block B). The planner publishes
 * model/qty/line/date/sequence → a WO with a folio. Materialists, operators and
 * supervision all watch the same live record. Readiness flags are flipped by
 * Material Staging (C) and Floor Quality (F); execution increments completed.
 *
 * Table prefixed `sf_` to avoid colliding with the legacy `work_orders` / plan
 * tables. Decoupled by denormalized model/line strings.
 */
@Entity('sf_work_orders')
@Index('idx_sf_wo_scope_status', ['tenant_id', 'plant_id', 'status'])
@Index('idx_sf_wo_line', ['line', 'status'])
export class SfWorkOrder extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 32, nullable: true })
  folio: string | null;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  model: string;

  @Column({ type: 'varchar', length: 16, default: 'A' })
  revision: string;

  @Index()
  @Column({ type: 'varchar', length: 32 })
  line: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  bay: string | null;

  @Column({ type: 'int', default: 0, name: 'quantity_planned' })
  quantityPlanned: number;

  @Column({ type: 'int', default: 0, name: 'quantity_completed' })
  quantityCompleted: number;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'scheduled_date' })
  scheduledDate: Date | null;

  /** Position in the line's run sequence (drag-to-resequence). */
  @Column({ type: 'int', default: 100 })
  sequence: number;

  @Column({ type: 'varchar', length: 8, default: 'MEDIUM' })
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

  @Column({ type: 'varchar', length: 16, default: 'RELEASED' })
  status: WorkOrderStatus;

  @Column({ type: 'varchar', length: 16, default: 'BY_UNIT', name: 'consumption_mode' })
  consumptionMode: ConsumptionMode;

  @Column({ type: 'varchar', length: 8, default: 'NONE', name: 'serial_control' })
  serialControl: SerialControl;

  /** Target takt per unit (sec) carried from the model↔line qualification. */
  @Column({ type: 'float', default: 0, name: 'takt_target_sec' })
  taktTargetSec: number;

  // ── Readiness (set by staging C / quality F; read for run gating) ──────────
  @Column({ type: 'boolean', default: false, name: 'material_ready' })
  materialReady: boolean;

  @Column({ type: 'boolean', default: true, name: 'quality_clear' })
  qualityClear: boolean;

  /** Whether first-piece (FAI) approval is required before this WO may run. */
  @Column({ type: 'boolean', default: false, name: 'fai_required' })
  faiRequired: boolean;

  @Column({ type: 'boolean', default: false, name: 'fai_approved' })
  faiApproved: boolean;

  /** Operator emails the supervisor authorized for this WO (the "acceso"). */
  @Column({ type: JSON_COLUMN_TYPE, nullable: true, name: 'authorized_operators' })
  authorizedOperators: string[] | null;

  @Column({ type: 'varchar', length: 64, nullable: true, name: 'program_id' })
  programId: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'customer' })
  customer: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'published_by' })
  publishedBy: string | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'published_at' })
  publishedAt: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'started_at' })
  startedAt: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'completed_at' })
  completedAt: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  notes: string | null;
}
