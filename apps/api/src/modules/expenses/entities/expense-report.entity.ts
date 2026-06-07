import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';
import type { ExpenseStatus } from '../expense-state';

export type ExpenseCategory =
  | 'TRAVEL'
  | 'MEALS'
  | 'LODGING'
  | 'SUPPLIES'
  | 'TRAINING'
  | 'OTHER';

/**
 * An employee expense report (FIN / AP). Folio from the central numbering service
 * (docType EXPENSE → EXP-…). Fully additive table `expense_reports`; employee is
 * denormalized.
 */
@Entity('expense_reports')
@Index('idx_expense_scope_status', ['tenant_id', 'plant_id', 'status'])
export class ExpenseReport extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 32, nullable: true })
  folio: string | null;

  @Index()
  @Column({ type: 'varchar', length: 160, name: 'employee_name' })
  employeeName: string;

  @Column({ type: 'varchar', length: 200 })
  description: string;

  @Column({ type: 'varchar', length: 12, default: 'OTHER' })
  category: ExpenseCategory;

  @Column({ type: 'float', default: 0 })
  amount: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'varchar', length: 12, default: 'DRAFT' })
  status: ExpenseStatus;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'approver_email' })
  approverEmail: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'reject_reason' })
  rejectReason: string | null;

  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true, name: 'program_id' })
  programId: string | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'expense_date' })
  expenseDate: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'approved_at' })
  approvedAt: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'reimbursed_at' })
  reimbursedAt: Date | null;
}
