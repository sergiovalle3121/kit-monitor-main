import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';
import { JSON_COLUMN_TYPE } from '../../../common/database/json-column-type';

export type MrpMode = 'propose' | 'auto';
export type MrpRunStatus = 'completed' | 'failed';

/** A material requirements planning run (PP02 / MD01). */
@Entity('erp_mrp_runs')
export class ErpMrpRun {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 32 })
  @Index({ unique: true })
  runNumber: string;

  @Column({ type: DATE_COLUMN_TYPE })
  runAt: Date;

  @Column({ type: 'int', default: 30 })
  horizonDays: number;

  @Column({ type: 'varchar', length: 8, default: 'propose' })
  mode: MrpMode;

  @Column({ type: 'varchar', length: 12, default: 'completed' })
  status: MrpRunStatus;

  @Column({ type: JSON_COLUMN_TYPE, nullable: true })
  summary: {
    parts?: number;
    requisitions?: number;
    plannedOrders?: number;
    shortages?: number;
    autoReleased?: boolean;
    [key: string]: unknown;
  } | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  createdBy: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
