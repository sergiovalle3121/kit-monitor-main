import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';
import { JSON_COLUMN_TYPE } from '../../../common/database/json-column-type';

export type MrpAction = 'buy' | 'make' | 'none';

/** Net-requirements result for one part in an MRP run. */
@Entity('erp_mrp_results')
export class ErpMrpResult {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  @Index()
  mrpRunId: number;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  partNumber: string;

  /** BOM low-level code (0 = finished good). */
  @Column({ type: 'int', default: 0 })
  level: number;

  @Column({ type: 'float', default: 0 })
  grossReq: number;

  @Column({ type: 'float', default: 0 })
  scheduledReceipts: number;

  @Column({ type: 'float', default: 0 })
  onHand: number;

  @Column({ type: 'float', default: 0 })
  safetyStock: number;

  @Column({ type: 'float', default: 0 })
  netReq: number;

  @Column({ type: 'float', default: 0 })
  plannedQty: number;

  @Column({ type: 'varchar', length: 8, default: 'none' })
  action: MrpAction;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  needBy: Date | null;

  /** Whether this part could not be sourced (no supplier / no BOM). */
  @Column({ type: 'boolean', default: false })
  shortage: boolean;

  @Column({ type: JSON_COLUMN_TYPE, nullable: true })
  peggedDemand: unknown;

  @CreateDateColumn()
  createdAt: Date;
}
