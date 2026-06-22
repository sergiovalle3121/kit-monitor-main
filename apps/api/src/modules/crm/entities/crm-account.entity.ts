import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';

/**
 * A commercial Account — the customer/prospect master that anchors the CRM and
 * the whole commercial front door of the EMS. An account aggregates contacts,
 * opportunities, quotes and activities, and bridges to the operational world via
 * `enterpriseCustomerCode` (enterprise_customers) so Sales and Operations share
 * one customer identity.
 *
 * Fully additive table `crm_accounts`. Relations are stored as plain id columns
 * (denormalized, no FK) to stay friendly with `synchronize: true`.
 */
export type AccountType = 'CUSTOMER' | 'PROSPECT' | 'PARTNER' | 'INACTIVE';
export type AccountTier = 'STRATEGIC' | 'A' | 'B' | 'C';
export type AccountStatus = 'ACTIVE' | 'ON_HOLD' | 'INACTIVE';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

@Entity('crm_accounts')
@Index('idx_acct_scope_status', ['tenant_id', 'plant_id', 'status'])
export class CrmAccount extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Human account code (e.g. AX-MOBILITY). Unique-ish per tenant by convention. */
  @Index()
  @Column({ type: 'varchar', length: 40 })
  code: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'legal_name' })
  legalName: string | null;

  @Column({ type: 'varchar', length: 16, default: 'PROSPECT' })
  type: AccountType;

  @Column({ type: 'varchar', length: 16, default: 'C' })
  tier: AccountTier;

  @Column({ type: 'varchar', length: 16, default: 'ACTIVE' })
  status: AccountStatus;

  @Column({ type: 'varchar', length: 80, nullable: true })
  industry: string | null;

  /** Finer market segment, e.g. "Automotive Tier-1", "Class-II Medical". */
  @Column({ type: 'varchar', length: 80, nullable: true })
  segment: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  website: string | null;

  /** Sales region: NAM | LATAM | EMEA | APAC. */
  @Column({ type: 'varchar', length: 24, nullable: true })
  region: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  country: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'address_line' })
  addressLine: string | null;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'varchar', length: 24, nullable: true, name: 'payment_terms' })
  paymentTerms: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  incoterm: string | null;

  @Column({ type: 'float', default: 0, name: 'credit_limit' })
  creditLimit: number;

  /** The customer's own annual revenue — for account sizing (not our sales). */
  @Column({ type: 'float', nullable: true, name: 'annual_revenue' })
  annualRevenue: number | null;

  @Column({ type: 'int', nullable: true })
  employees: number | null;

  @Column({ type: 'varchar', length: 40, nullable: true, name: 'tax_id' })
  taxId: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  duns: string | null;

  /** Account manager / owner email (commercial responsibility). */
  @Index()
  @Column({ type: 'varchar', length: 200, nullable: true, name: 'owner_email' })
  ownerEmail: string | null;

  /** Self-reference for corporate hierarchies (parent / HQ account). */
  @Column({ type: 'varchar', length: 36, nullable: true, name: 'parent_account_id' })
  parentAccountId: string | null;

  /** Bridge to the operational customer master (enterprise_customers.code). */
  @Index()
  @Column({ type: 'varchar', length: 40, nullable: true, name: 'enterprise_customer_code' })
  enterpriseCustomerCode: string | null;

  /** 0–100 relationship/account-health composite. */
  @Column({ type: 'int', default: 70, name: 'health_score' })
  healthScore: number;

  @Column({ type: 'varchar', length: 12, default: 'LOW', name: 'risk_level' })
  riskLevel: RiskLevel;

  /** Net Promoter / satisfaction signal (-100..100), optional. */
  @Column({ type: 'int', nullable: true, name: 'nps_score' })
  npsScore: number | null;

  @Column({ type: 'simple-array', nullable: true })
  tags: string[] | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
