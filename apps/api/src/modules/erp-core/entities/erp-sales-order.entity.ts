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

export type SalesOrderStatus =
  | 'draft'
  | 'confirmed'
  | 'in_production'
  | 'partially_shipped'
  | 'shipped'
  | 'invoiced'
  | 'closed'
  | 'cancelled';

/** Sales order header (VA01). */
@Entity('erp_sales_orders')
export class ErpSalesOrder {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'tenant_id' })
  tenant_id: string | null;

  @Column({ type: 'varchar', length: 32 })
  @Index({ unique: true })
  soNumber: string;

  @Column({ type: 'varchar', length: 32 })
  @Index()
  customerCode: string;

  @Column({ type: 'varchar', length: 160, nullable: true })
  customerName: string | null;

  @Column({ type: DATE_COLUMN_TYPE })
  orderDate: Date;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  requestedDate: Date | null;

  @Column({ type: 'varchar', length: 24, default: 'draft' })
  @Index()
  status: SalesOrderStatus;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column(money())
  subtotal: number;

  @Column(money())
  taxAmount: number;

  @Column(money())
  total: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  createdBy: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
