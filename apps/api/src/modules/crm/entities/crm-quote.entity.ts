import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';

/**
 * A customer quotation (the EMS RFQ → Quote → PO flow). Carries the commercial
 * envelope (terms, validity, lead time) and rolled-up money (subtotal, total,
 * margin, estimated annual value from EAU). Lines live in `crm_quote_lines`.
 * Folio QT- from the central numbering service. Additive table `crm_quotes`.
 */
export type QuoteStatus =
  | 'DRAFT'
  | 'SENT'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'EXPIRED';

@Entity('crm_quotes')
@Index('idx_quote_account', ['tenant_id', 'account_id'])
@Index('idx_quote_scope_status', ['tenant_id', 'plant_id', 'status'])
export class CrmQuote extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 32, nullable: true })
  folio: string | null;

  @Index()
  @Column({ type: 'varchar', length: 36, name: 'account_id' })
  account_id: string;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true, name: 'opportunity_id' })
  opportunityId: string | null;

  @Column({ type: 'int', default: 1 })
  rev: number;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'varchar', length: 16, default: 'DRAFT' })
  status: QuoteStatus;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'valid_until' })
  validUntil: Date | null;

  @Column({ type: 'varchar', length: 24, nullable: true, name: 'payment_terms' })
  paymentTerms: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  incoterm: string | null;

  @Column({ type: 'int', nullable: true, name: 'lead_time_days' })
  leadTimeDays: number | null;

  /** Sum of line extended price (qty × unit price), before discount. */
  @Column({ type: 'float', default: 0 })
  subtotal: number;

  @Column({ type: 'float', default: 0, name: 'discount_pct' })
  discountPct: number;

  /** subtotal × (1 − discount). */
  @Column({ type: 'float', default: 0 })
  total: number;

  /** Sum of line EAU × unit price — the annualized program value. */
  @Column({ type: 'float', default: 0, name: 'est_annual_value' })
  estAnnualValue: number;

  /** Blended gross margin % across lines (price vs cost). */
  @Column({ type: 'float', nullable: true, name: 'margin_pct' })
  marginPct: number | null;

  @Index()
  @Column({ type: 'varchar', length: 200, nullable: true, name: 'owner_email' })
  ownerEmail: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'sent_at' })
  sentAt: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'decided_at' })
  decidedAt: Date | null;
}
