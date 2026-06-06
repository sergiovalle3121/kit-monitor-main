import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  Unique,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { money } from './money';

/**
 * Supplier price / sourcing record for a part. Feeds the MRP run (lead time,
 * MOQ, preferred source) and PO creation (unit price).
 */
@Entity('erp_supplier_prices')
@Unique(['supplierId', 'partNumber'])
export class ErpSupplierPrice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  @Index()
  supplierId: number;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  partNumber: string;

  @Column(money(6))
  unitPrice: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'float', default: 1 })
  moq: number; // minimum order quantity

  @Column({ type: 'int', default: 7 })
  leadTimeDays: number;

  @Column({ type: 'boolean', default: false })
  preferred: boolean;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
