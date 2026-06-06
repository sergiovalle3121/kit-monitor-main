import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';
import { decimalToNumber } from '../../erp-core/entities/money';
import { DEFAULT_MODEL, ESCALATION_MODEL } from '../ai-pricing';

/**
 * Per-tenant AI configuration. One row per tenant; the sentinel '__default__'
 * row holds the platform-wide defaults used when a tenant has no own row.
 *
 * Hybrid billing: if `byoApiKeyCipher` is set the tenant pays its own usage on
 * its own key (no budget enforced). Otherwise the platform key is used and the
 * monthly token budget caps spend so cost can never run away.
 */
@Entity('ai_tenant_config')
export class AiTenantConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64, default: '__default__' })
  tenantId: string;

  @Column({ default: true })
  enabled: boolean;

  /** Encrypted BYO Anthropic API key (AES-256-GCM). Null → use platform key. */
  @Column({ type: 'text', nullable: true })
  byoApiKeyCipher: string | null;

  @Column({ type: 'varchar', length: 8, nullable: true })
  byoKeyLast4: string | null;

  @Column({ type: 'varchar', length: 64, default: DEFAULT_MODEL })
  defaultModel: string;

  @Column({ type: 'varchar', length: 64, default: ESCALATION_MODEL })
  escalationModel: string;

  /** Monthly token cap when on the platform key. Ignored for BYO tenants. */
  @Column({ type: 'bigint', default: 1_000_000, transformer: decimalToNumber })
  monthlyTokenBudget: number;

  @Column({ type: 'bigint', default: 0, transformer: decimalToNumber })
  tokensUsedThisPeriod: number;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  periodStart: Date | null;

  @Column({ type: 'int', default: 60 })
  rateLimitPerHour: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
