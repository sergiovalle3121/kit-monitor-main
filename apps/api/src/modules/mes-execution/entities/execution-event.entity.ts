import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';

/**
 * Immutable record of a single "Confirm advance" action (the backflush event).
 * Feeds hour-by-hour / OEE and serial genealogy. Idempotent via clientRequestId.
 */
@Entity('mes_execution_events')
export class ExecutionEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'tenant_id' })
  tenant_id: string | null;

  @Column({ type: 'int' })
  @Index()
  executionId: number;

  @Column({ type: 'int' })
  @Index()
  executionStepId: number;

  /** Good units confirmed in this event. */
  @Column({ type: 'float' })
  quantity: number;

  @Column({ type: 'float', default: 0 })
  scrapQty: number;

  @Column({ type: 'varchar', length: 120, nullable: true })
  operator: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  operatorPosition: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  serial: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  lot: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  @Index({ unique: true })
  clientRequestId: string | null;

  @Column({ type: 'varchar', length: 280, nullable: true })
  notes: string | null;

  @Column({ type: DATE_COLUMN_TYPE })
  timestamp: Date;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  revertedAt: Date | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  revertedReason: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
