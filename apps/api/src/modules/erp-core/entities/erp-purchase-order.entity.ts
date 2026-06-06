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

export type PurchaseOrderStatus =
  | 'draft'
  | 'issued'
  | 'partially_received'
  | 'received'
  | 'closed'
  | 'cancelled';

/** Purchase order header (ME21N / MM02). */
@Entity('erp_purchase_orders')
export class ErpPurchaseOrder {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 32 })
  @Index({ unique: true })
  poNumber: string;

  @Column({ type: 'int' })
  @Index()
  supplierId: number;

  @Column({ type: 'varchar', length: 160, nullable: true })
  supplierName: string | null;

  @Column({ type: 'varchar', length: 24, default: 'draft' })
  @Index()
  status: PurchaseOrderStatus;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  /** Warehouse goods are received into. */
  @Column({ type: 'varchar', length: 64, default: 'WH-RAW' })
  warehouseId: string;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  orderDate: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  expectedDate: Date | null;

  @Column(money())
  totalAmount: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  createdBy: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
