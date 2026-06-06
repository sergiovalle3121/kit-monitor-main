import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';
import { money } from './money';

@Entity('erp_invoice_lines')
export class ErpInvoiceLine {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  @Index()
  invoiceId: number;

  @Column({ type: 'int' })
  lineNo: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  partNumber: string | null;

  @Column({ type: 'varchar', length: 255 })
  description: string;

  @Column({ type: 'float', default: 1 })
  quantity: number;

  @Column(money(6))
  unitPrice: number;

  @Column(money())
  lineTotal: number;

  @Column({ type: 'float', default: 0 })
  taxRate: number; // percent, e.g. 16

  /** Revenue (AR) or expense/inventory (AP) account this line books to. */
  @Column({ type: 'varchar', length: 24, nullable: true })
  accountCode: string | null;
}
