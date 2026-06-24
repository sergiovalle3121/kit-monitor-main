import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';
import { money } from './money';

/**
 * A cost layer created on each receipt (FIFO/LIFO valuation). Consumption draws
 * down `qtyRemaining` oldest-first (FIFO) or newest-first (LIFO).
 */
@Entity('erp_valuation_layers')
@Index(['partNumber', 'receiptDate'])
export class ErpValuationLayer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'tenant_id' })
  tenant_id: string | null;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  partNumber: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  warehouseId: string | null;

  @Column({ type: DATE_COLUMN_TYPE })
  receiptDate: Date;

  @Column({ type: 'float' })
  qtyReceived: number;

  @Column({ type: 'float' })
  qtyRemaining: number;

  @Column(money(6))
  unitCost: number;

  @Column({ type: 'varchar', length: 32, nullable: true })
  sourceType: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  sourceId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
