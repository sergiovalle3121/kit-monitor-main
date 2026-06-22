import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';
import type { LaborType } from '../hr-analytics';

export type EmploymentType = 'FULL_TIME' | 'TEMP' | 'CONTRACTOR' | 'INTERN';
export type EmployeeStatus = 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED';
export type TerminationType = 'VOLUNTARY' | 'INVOLUNTARY';

/**
 * The workforce backbone — a real "colaborador" (distinct from a system `user`).
 * This is what RH headcount, turnover, absenteeism, span-of-control and labor
 * cost are computed from. Self-contained & additive (everything denormalized to
 * avoid coupling with users/org). Live derived signals (tenure, flight-risk) are
 * computed at read time, not stored.
 */
@Entity('hr_employees')
@Index('idx_hr_emp_scope_status', ['tenant_id', 'plant_id', 'status'])
export class HrEmployee extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 32, nullable: true })
  folio: string | null;

  @Index()
  @Column({ type: 'varchar', length: 40, nullable: true, name: 'employee_number' })
  employeeNumber: string | null;

  @Column({ type: 'varchar', length: 120, name: 'first_name' })
  firstName: string;

  @Column({ type: 'varchar', length: 120, name: 'last_name' })
  lastName: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  position: string | null;

  @Index()
  @Column({ type: 'varchar', length: 120, nullable: true })
  area: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  department: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true, name: 'cost_center' })
  costCenter: string | null;

  @Index()
  @Column({ type: 'varchar', length: 20, nullable: true })
  shift: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  line: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  station: string | null;

  @Column({ type: 'varchar', length: 12, default: 'DIRECT', name: 'labor_type' })
  laborType: LaborType;

  @Column({ type: 'varchar', length: 16, default: 'FULL_TIME', name: 'employment_type' })
  employmentType: EmploymentType;

  @Column({ type: 'varchar', length: 16, default: 'ACTIVE' })
  status: EmployeeStatus;

  @Index()
  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'hire_date' })
  hireDate: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'termination_date' })
  terminationDate: Date | null;

  @Column({ type: 'varchar', length: 16, nullable: true, name: 'termination_type' })
  terminationType: TerminationType | null;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'termination_reason' })
  terminationReason: string | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'birth_date' })
  birthDate: Date | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  gender: string | null;

  /** Monthly fully-loaded labor cost (MXN). float per repo money convention. */
  @Column({ type: 'float', nullable: true, name: 'monthly_cost' })
  monthlyCost: number | null;

  @Column({ type: 'varchar', length: 160, nullable: true, name: 'supervisor_name' })
  supervisorName: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true, name: 'manager_employee_number' })
  managerEmployeeNumber: string | null;

  /** Optional engagement pulse 0..100 (feeds flight-risk). */
  @Column({ type: 'float', nullable: true, name: 'engagement_score' })
  engagementScore: number | null;
}
