import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';

export type ExecutionStepStatus =
  | 'pending'
  | 'in_process'
  | 'blocked'
  | 'completed';

/**
 * Progress of one station (ProcessStep) within a Work Order execution.
 *
 * Counters are kept INDEPENDENT per station (so the same model can run on
 * different lines in parallel), but `confirmAdvance` enforces a forward WIP
 * cap: a station can never report more good units than the upstream station
 * has released, and non-conforming units are held in `segregatedQty` so they
 * never count as good nor flow downstream.
 */
@Entity('mes_execution_steps')
@Index(['executionId', 'stepId'], { unique: true })
export class ExecutionStep {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  @Index()
  executionId: number;

  /** FK to process_steps.id (the authored route step). */
  @Column({ type: 'int' })
  stepId: number;

  @Column({ type: 'int', default: 1 })
  sequence: number;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  stationType: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  visualAidId: string | null;

  @Column({ type: 'text', nullable: true })
  instructions: string | null;

  @Column({ type: 'int', default: 0 })
  unitsTarget: number;

  @Column({ type: 'float', default: 0 })
  unitsCompleted: number;

  @Column({ type: 'float', default: 0 })
  scrapQty: number;

  /** Non-conforming units held at this station awaiting quality disposition. */
  @Column({ type: 'float', default: 0 })
  segregatedQty: number;

  @Column({ type: 'varchar', length: 24, default: 'pending' })
  @Index()
  status: ExecutionStepStatus;

  @Column({ type: 'varchar', length: 120, nullable: true })
  currentOperator: string | null;

  @Column({ type: 'varchar', length: 240, nullable: true })
  blockReason: string | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  startedAt: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  completedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
