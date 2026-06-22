import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';
import type { LaborType } from '../hr-analytics';
import type { RequisitionStatus } from '../hr-lifecycle';

export type RequisitionPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type RequisitionReason = 'GROWTH' | 'REPLACEMENT' | 'RAMP';

/**
 * A job requisition / vacante. In EMS, requisitions cluster around program ramps
 * (a new customer = a wall of openings), so `program`/`customer` are captured to
 * link headcount demand to the business. Folio VAC- from the central numbering.
 */
@Entity('hr_requisitions')
@Index('idx_hr_req_scope_status', ['tenant_id', 'plant_id', 'status'])
export class HrRequisition extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 32, nullable: true })
  folio: string | null;

  @Column({ type: 'varchar', length: 160 })
  title: string;

  @Index()
  @Column({ type: 'varchar', length: 120, nullable: true })
  area: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  department: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true, name: 'cost_center' })
  costCenter: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  shift: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  line: string | null;

  @Column({ type: 'varchar', length: 12, default: 'DIRECT', name: 'labor_type' })
  laborType: LaborType;

  @Column({ type: 'int', default: 1 })
  openings: number;

  @Column({ type: 'int', default: 0, name: 'filled_count' })
  filledCount: number;

  @Column({ type: 'varchar', length: 16, default: 'OPEN' })
  status: RequisitionStatus;

  @Column({ type: 'varchar', length: 12, default: 'MEDIUM' })
  priority: RequisitionPriority;

  @Column({ type: 'varchar', length: 16, default: 'GROWTH' })
  reason: RequisitionReason;

  @Column({ type: 'varchar', length: 120, nullable: true })
  program: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  customer: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true, name: 'hiring_manager' })
  hiringManager: string | null;

  @Index()
  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'opened_date' })
  openedDate: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'target_fill_date' })
  targetFillDate: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'filled_date' })
  filledDate: Date | null;
}
