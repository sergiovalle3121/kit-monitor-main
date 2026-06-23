import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';

/**
 * How often a preventive plan recurs. Calendar-based (days/weeks/months); a
 * meter-based trigger (machine-hours/cycles) is a documented follow-up — it
 * needs telemetry the CMMS does not yet capture.
 */
export type PmFrequencyType = 'DAYS' | 'WEEKS' | 'MONTHS';

/**
 * A recurring preventive-maintenance plan for an asset (TPM). When `nextDueDate`
 * arrives the planner generates a PREVENTIVE `maintenance_order` from it (manual
 * button today; an opt-in cron can alert on due plans). Generating/closing a PM
 * advances `lastDoneDate` and recomputes `nextDueDate`.
 *
 * Fully additive table — brand new, every column nullable or defaulted. Does not
 * touch `assets` / `maintenance_orders`.
 */
@Entity('maintenance_pm_plans')
@Index('idx_pm_scope_active', ['tenant_id', 'plant_id', 'active'])
export class MaintenancePmPlan extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true, name: 'asset_id' })
  assetId: string | null;

  /** Denormalized for list rendering without a join (mirrors maintenance_orders). */
  @Column({ type: 'varchar', length: 160, nullable: true, name: 'asset_name' })
  assetName: string | null;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 8, default: 'DAYS', name: 'frequency_type' })
  frequencyType: PmFrequencyType;

  @Column({ type: 'int', default: 30, name: 'frequency_value' })
  frequencyValue: number;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'last_done_date' })
  lastDoneDate: Date | null;

  @Index()
  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'next_due_date' })
  nextDueDate: Date | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'assigned_to' })
  assignedTo: string | null;
}
