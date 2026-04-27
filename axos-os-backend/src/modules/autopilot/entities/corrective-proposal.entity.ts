import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { DATE_COLUMN_TYPE, JSON_COLUMN_TYPE } from '../../../common/database/date-column-type';

export type ProposalStatus   = 'pending' | 'executed' | 'dismissed' | 'expired';
export type ProposalCategory = 'bottleneck' | 'sigma_instability' | 'shortage' | 'maintenance';
export type ProposalSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ExecutionType    = 'wip_rebalance' | 'resupply_trigger' | 'maintenance_audit';

@Entity('corrective_proposals')
export class CorrectiveProposal {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  @Index()
  status: ProposalStatus;

  @Column({ type: 'varchar', length: 30 })
  @Index()
  category: ProposalCategory;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 20, default: 'medium' })
  severity: ProposalSeverity;

  @Column({ type: 'varchar', length: 100, nullable: true })
  @Index()
  tenantId: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  line: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  model: string;

  @Column({ type: 'integer', nullable: true })
  bayId: number;

  @Column({ type: 'float', nullable: true })
  severityScore: number;

  @Column({ type: 'float', nullable: true })
  sigmaLevel: number;

  /** Structured payload describing what the execute action should do. */
  @Column({ type: JSON_COLUMN_TYPE, nullable: true })
  executionPayload: Record<string, any> | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  executionType: ExecutionType | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  executedAt: Date | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  executedBy: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
