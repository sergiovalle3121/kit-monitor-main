import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';

export type ExecutionStatus = 'open' | 'completed' | 'cancelled';

/**
 * The header that binds a Work Order (Plan + Kit) to the model's process route
 * for shop-floor execution. One open execution per plan; it pins the route
 * revision being run so re-authoring the route never mutates a live run.
 */
@Entity('mes_work_order_executions')
export class WorkOrderExecution {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'tenant_id' })
  tenant_id: string | null;

  @Column({ type: 'int' })
  @Index({ unique: true })
  planId: number;

  @Column({ type: 'int', nullable: true })
  kitId: number | null;

  @Column({ type: 'varchar', length: 120 })
  @Index()
  workOrder: string;

  @Column({ type: 'varchar', length: 120 })
  @Index()
  model: string;

  @Column({ type: 'varchar', length: 80, default: '1.0' })
  revision: string;

  @Column({ type: 'int', nullable: true })
  line: number | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  buildingId: string | null;

  @Column({ type: 'int', default: 0 })
  quantity: number;

  @Column({ type: 'varchar', length: 24, default: 'open' })
  @Index()
  status: ExecutionStatus;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  startedAt: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  completedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
