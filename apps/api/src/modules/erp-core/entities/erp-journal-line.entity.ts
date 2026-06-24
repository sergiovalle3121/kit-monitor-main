import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';
import { money } from './money';

/**
 * A single debit or credit line of a journal entry. One of `debit`/`credit` is
 * non-zero. Carries optional analytical dimensions (cost center, part number,
 * work order, partner) for reporting.
 */
@Entity('erp_journal_lines')
export class ErpJournalLine {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'tenant_id' })
  tenant_id: string | null;

  @Column({ type: 'int' })
  @Index()
  entryId: number;

  @Column({ type: 'int' })
  lineNo: number;

  @Column({ type: 'varchar', length: 24 })
  @Index()
  accountCode: string;

  @Column({ type: 'varchar', length: 120 })
  accountName: string;

  @Column(money())
  debit: number;

  @Column(money())
  credit: number;

  @Column({ type: 'varchar', length: 24, nullable: true })
  @Index()
  costCenterCode: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  partNumber: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  workOrder: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  partnerType: string | null; // customer | supplier

  @Column({ type: 'varchar', length: 64, nullable: true })
  partnerId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;
}
