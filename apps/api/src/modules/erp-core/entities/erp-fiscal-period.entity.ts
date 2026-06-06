import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';

export type FiscalPeriodStatus = 'open' | 'closed';

/** Posting period (YYYY-MM). A soft close blocks new postings into the period. */
@Entity('erp_fiscal_periods')
export class ErpFiscalPeriod {
  @PrimaryColumn({ type: 'varchar', length: 7 })
  period: string; // YYYY-MM

  @Column({ type: 'varchar', length: 8, default: 'open' })
  status: FiscalPeriodStatus;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  closedAt: Date | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  closedBy: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
