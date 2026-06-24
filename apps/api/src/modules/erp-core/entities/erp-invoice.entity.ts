import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';
import { money } from './money';

export type InvoiceKind = 'AR' | 'AP';
export type InvoicePartnerType = 'customer' | 'supplier';
export type InvoiceStatus =
  | 'draft'
  | 'posted'
  | 'partially_paid'
  | 'paid'
  | 'cancelled';

/** AR (customer) / AP (supplier) invoice header (FIN02 / SD03). */
@Entity('erp_invoices')
export class ErpInvoice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'tenant_id' })
  tenant_id: string | null;

  @Column({ type: 'varchar', length: 32 })
  @Index({ unique: true })
  invoiceNumber: string;

  @Column({ type: 'varchar', length: 4 })
  @Index()
  kind: InvoiceKind;

  @Column({ type: 'varchar', length: 16 })
  partnerType: InvoicePartnerType;

  @Column({ type: 'varchar', length: 64 })
  @Index()
  partnerId: string;

  @Column({ type: 'varchar', length: 160, nullable: true })
  partnerName: string | null;

  @Column({ type: 'int', nullable: true })
  salesOrderId: number | null;

  @Column({ type: 'int', nullable: true })
  purchaseOrderId: number | null;

  @Column({ type: DATE_COLUMN_TYPE })
  issueDate: Date;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  dueDate: Date | null;

  @Column({ type: 'varchar', length: 7 })
  @Index()
  period: string;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column(money())
  subtotal: number;

  @Column(money())
  taxAmount: number;

  @Column(money())
  total: number;

  @Column(money())
  amountPaid: number;

  @Column({ type: 'varchar', length: 24, default: 'draft' })
  @Index()
  status: InvoiceStatus;

  /** GL journal entry created when the invoice is posted. */
  @Column({ type: 'int', nullable: true })
  journalEntryId: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  narrative: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  createdBy: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
