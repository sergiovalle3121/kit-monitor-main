import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';
import type { OpportunityStatus } from '../opportunity-state';

/**
 * A CRM sales opportunity (SD / CRM pipeline). Folio from the central numbering
 * service (docType OPPORTUNITY → OPP-…). Fully additive table
 * `crm_opportunities`; customer/contact denormalized.
 */
@Entity('crm_opportunities')
@Index('idx_opp_scope_status', ['tenant_id', 'plant_id', 'status'])
export class Opportunity extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 32, nullable: true })
  folio: string | null;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'customer_name' })
  customerName: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true, name: 'contact_name' })
  contactName: string | null;

  @Column({ type: 'varchar', length: 12, default: 'LEAD' })
  status: OpportunityStatus;

  @Column({ type: 'float', default: 0, name: 'estimated_value' })
  estimatedValue: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'int', default: 10 })
  probability: number;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'owner_email' })
  ownerEmail: string | null;

  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true, name: 'program_id' })
  programId: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'expected_close_date' })
  expectedCloseDate: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'closed_at' })
  closedAt: Date | null;
}
