import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';
import { money } from './money';

@Entity('erp_purchase_order_lines')
export class ErpPurchaseOrderLine {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  @Index()
  poId: number;

  @Column({ type: 'int' })
  lineNo: number;

  @Column({ type: 'varchar', length: 100 })
  partNumber: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ type: 'float' })
  quantity: number;

  @Column(money(6))
  unitPrice: number;

  @Column({ type: 'float', default: 0 })
  qtyReceived: number;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  needBy: Date | null;

  @Column(money())
  lineTotal: number;
}
