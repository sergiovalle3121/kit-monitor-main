import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { money } from '../../erp-core/entities/money';

/** One row per AI turn — the audit + metering trail for cost attribution. */
@Entity('ai_usage_log')
@Index(['tenantId', 'createdAt'])
@Index(['userEmail', 'createdAt'])
export class AiUsageLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  tenantId: string | null;

  @Column()
  userEmail: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  conversationId: string | null;

  @Column()
  model: string;

  @Column({ default: 'copilot' })
  feature: string;

  @Column({ type: 'int', default: 0 })
  inputTokens: number;

  @Column({ type: 'int', default: 0 })
  outputTokens: number;

  @Column({ type: 'int', default: 0 })
  cacheReadTokens: number;

  @Column({ type: 'int', default: 0 })
  cacheWriteTokens: number;

  @Column(money(6))
  costUsd: number;

  @Column({ default: false })
  usedByoKey: boolean;

  @Column({ default: false })
  mock: boolean;

  @Column({ type: 'int', default: 0 })
  toolCalls: number;

  @CreateDateColumn()
  createdAt: Date;
}
