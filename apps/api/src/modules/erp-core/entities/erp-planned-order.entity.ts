import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';

export type PlannedOrderStatus = 'planned' | 'released' | 'cancelled';

/**
 * A planned production order produced by MRP for a MAKE part. Releasing it
 * (PP03) converts it into a real work order (`Plan`).
 */
@Entity('erp_planned_orders')
export class ErpPlannedOrder {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 32 })
  @Index({ unique: true })
  plannedOrderNumber: string;

  @Column({ type: 'int', nullable: true })
  @Index()
  mrpRunId: number | null;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  partNumber: string; // model to build

  @Column({ type: 'float' })
  quantity: number;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  needBy: Date | null;

  @Column({ type: 'varchar', length: 12, default: 'planned' })
  @Index()
  status: PlannedOrderStatus;

  /** The Plan (work order) created when this planned order is released. */
  @Column({ type: 'int', nullable: true })
  releasedPlanId: number | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  createdBy: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
