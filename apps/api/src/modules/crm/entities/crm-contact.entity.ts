import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';

/**
 * A person at a customer account — buyers, engineers, quality, executives. The
 * buying-role + department fields let Sales map the buying center (decision
 * makers, influencers, gatekeepers, champions). Additive table `crm_contacts`.
 */
export type ContactDepartment =
  | 'PROCUREMENT'
  | 'ENGINEERING'
  | 'QUALITY'
  | 'EXECUTIVE'
  | 'SUPPLY_CHAIN'
  | 'FINANCE'
  | 'OPERATIONS'
  | 'OTHER';
export type BuyingRole =
  | 'DECISION_MAKER'
  | 'INFLUENCER'
  | 'CHAMPION'
  | 'USER'
  | 'GATEKEEPER';

@Entity('crm_contacts')
@Index('idx_contact_account', ['tenant_id', 'account_id'])
export class CrmContact extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 36, name: 'account_id' })
  account_id: string;

  @Column({ type: 'varchar', length: 80, name: 'first_name' })
  firstName: string;

  @Column({ type: 'varchar', length: 80, nullable: true, name: 'last_name' })
  lastName: string | null;

  /** Job title, e.g. "Commodity Manager", "NPI Quality Lead". */
  @Column({ type: 'varchar', length: 120, nullable: true })
  title: string | null;

  @Column({ type: 'varchar', length: 24, nullable: true })
  department: ContactDepartment | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  mobile: string | null;

  @Column({ type: 'boolean', default: false, name: 'is_primary' })
  isPrimary: boolean;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'buying_role' })
  buyingRole: BuyingRole | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  linkedin: string | null;

  @Column({ type: 'varchar', length: 12, default: 'ACTIVE' })
  status: 'ACTIVE' | 'INACTIVE';

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
