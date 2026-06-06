import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';
import { money } from './money';

export type JournalDocType =
  | 'GL'
  | 'AR'
  | 'AP'
  | 'INV'
  | 'PROD'
  | 'SALES'
  | 'PURCH';
export type JournalStatus = 'draft' | 'posted' | 'reversed';

/**
 * Double-entry journal HEADER (FIN01 / FB01). Groups balanced debit/credit
 * lines. Every inventory/sales/purchasing event that has a financial effect
 * posts one of these (debit total === credit total, enforced in the service).
 */
@Entity('erp_journal_entries')
export class ErpJournalEntry {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 32 })
  @Index({ unique: true })
  docNumber: string;

  @Column({ type: DATE_COLUMN_TYPE })
  @Index()
  postingDate: Date;

  @Column({ type: 'varchar', length: 7 })
  @Index()
  period: string; // YYYY-MM

  @Column({ type: 'varchar', length: 16, default: 'GL' })
  docType: JournalDocType;

  @Column({ type: 'varchar', length: 40, nullable: true })
  sourceType: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  @Index()
  sourceId: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  reference: string | null;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column(money())
  totalDebit: number;

  @Column(money())
  totalCredit: number;

  @Column({ type: 'varchar', length: 16, default: 'posted' })
  @Index()
  status: JournalStatus;

  @Column({ type: 'varchar', length: 24, nullable: true })
  costCenterCode: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  narrative: string | null;

  /** When this entry reverses another, the reversed entry id. */
  @Column({ type: 'int', nullable: true })
  reversalOf: number | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  actorName: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  @Index()
  tenantId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
