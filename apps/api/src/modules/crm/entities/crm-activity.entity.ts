import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';

/**
 * A timeline event / task against an account, contact, opportunity or quote.
 * Drives the customer engagement timeline and the "open tasks / next actions"
 * worklist that keeps the pipeline honest. Additive table `crm_activities`.
 */
export type ActivityType =
  | 'CALL'
  | 'EMAIL'
  | 'MEETING'
  | 'VISIT'
  | 'NOTE'
  | 'TASK';
export type ActivityStatus = 'OPEN' | 'DONE' | 'CANCELLED';
export type ActivityDirection = 'INBOUND' | 'OUTBOUND';

@Entity('crm_activities')
@Index('idx_activity_account', ['tenant_id', 'account_id'])
@Index('idx_activity_owner_status', ['tenant_id', 'ownerEmail', 'status'])
export class CrmActivity extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true, name: 'account_id' })
  account_id: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'contact_id' })
  contactId: string | null;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true, name: 'opportunity_id' })
  opportunityId: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'quote_id' })
  quoteId: string | null;

  @Column({ type: 'varchar', length: 16, default: 'NOTE' })
  type: ActivityType;

  @Column({ type: 'varchar', length: 200 })
  subject: string;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  @Column({ type: 'varchar', length: 12, nullable: true })
  direction: ActivityDirection | null;

  @Column({ type: 'varchar', length: 12, default: 'OPEN' })
  status: ActivityStatus;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'due_at' })
  dueAt: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'completed_at' })
  completedAt: Date | null;

  @Index()
  @Column({ type: 'varchar', length: 200, nullable: true, name: 'owner_email' })
  ownerEmail: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  outcome: string | null;
}
