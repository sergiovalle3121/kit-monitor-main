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
 * Per-tenant CIDE configuration. One row per tenant; the sentinel '__default__'
 * row holds the platform-wide defaults used when a tenant has no own row.
 *
 * CIDE runs on a self-hosted, open-weight model (no external AI vendor, no
 * per-token billing), so there is no API key to store. The monthly token figure
 * is now a **usage guardrail** (capacity), not a spend cap. The `byo*` columns
 * below are legacy from the previous Anthropic integration and are retained,
 * unused, only to keep the schema additive (see DECISIONS.md §2).
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

  /** @deprecated Legacy Anthropic BYO key column. Unused under CIDE (self-hosted). */
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

  /**
   * Whether analytical questions auto-escalate to the stronger model tier.
   * `null` = inherit the process default (`CIDE_AUTO_ESCALATE`); true/false
   * overrides it per tenant. Only meaningful when the engine actually serves the
   * escalation model.
   */
  @Column({ type: 'boolean', nullable: true })
  autoEscalate: boolean | null;

  /**
   * Free-text company knowledge the admin teaches CIDE (FAQs, policies,
   * definitions, naming, context). Injected into the system prompt so CIDE
   * answers with it. Plain text; capped at the DTO layer.
   */
  @Column({ type: 'text', nullable: true })
  knowledge: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
