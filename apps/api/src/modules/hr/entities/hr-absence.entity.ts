import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';

export type AbsenceType =
  | 'ABSENCE'
  | 'LATE'
  | 'SICK'
  | 'VACATION'
  | 'PERMIT'
  | 'SUSPENSION';

/**
 * A single attendance event (absence / tardiness / leave). Backs the absenteeism
 * KPIs and feeds per-employee flight-risk. Denormalized employee fields so the
 * record stands alone. One row per event/day.
 */
@Entity('hr_absences')
@Index('idx_hr_abs_scope_date', ['tenant_id', 'plant_id', 'date'])
export class HrAbsence extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid', nullable: true, name: 'employee_id' })
  employeeId: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true, name: 'employee_number' })
  employeeNumber: string | null;

  @Column({ type: 'varchar', length: 160, name: 'employee_name' })
  employeeName: string;

  @Index()
  @Column({ type: 'varchar', length: 120, nullable: true })
  area: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  shift: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  line: string | null;

  @Index()
  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  date: Date | null;

  @Column({ type: 'varchar', length: 16, default: 'ABSENCE' })
  type: AbsenceType;

  @Column({ type: 'boolean', default: false })
  justified: boolean;

  /** Hours lost (a full shift ≈ 9h). */
  @Column({ type: 'float', default: 0 })
  hours: number;

  @Column({ type: 'varchar', length: 200, nullable: true })
  reason: string | null;
}
