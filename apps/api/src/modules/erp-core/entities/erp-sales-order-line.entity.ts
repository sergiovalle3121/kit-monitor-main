import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';
import { money } from './money';

@Entity('erp_sales_order_lines')
export class ErpSalesOrderLine {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  @Index()
  soId: number;

  @Column({ type: 'int' })
  lineNo: number;

  /** The finished model / part being sold. */
  @Column({ type: 'varchar', length: 100 })
  model: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ type: 'float' })
  quantity: number;

  @Column(money(6))
  unitPrice: number;

  @Column({ type: 'float', default: 0 })
  qtyShipped: number;

  @Column({ type: 'float', default: 0 })
  qtyInvoiced: number;

  @Column({ type: 'float', default: 0 })
  taxRate: number;

  @Column(money())
  lineTotal: number;
}
