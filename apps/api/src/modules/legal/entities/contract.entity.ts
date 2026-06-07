import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';
import type { ContractStatus } from '../contract-state';

export type ContractType =
  | 'CUSTOMER'
  | 'SUPPLIER'
  | 'NDA'
  | 'LEASE'
  | 'SERVICE'
  | 'OTHER';

/**
 * A legal contract / agreement. Folio from the central numbering service
 * (docType CONTRACT → CON-…). Fully additive table. `endDate` drives the
 * expiry alerts; `value`/`currency` back the portfolio KPIs.
 */
@Entity('contracts')
@Index('idx_contract_scope_status', ['tenant_id', 'plant_id', 'status'])
export class Contract extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 32, nullable: true })
  folio: string | null;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  counterparty: string | null;

  @Column({ type: 'varchar', length: 12, default: 'OTHER' })
  type: ContractType;

  @Column({ type: 'varchar', length: 12, default: 'DRAFT' })
  status: ContractStatus;

  @Column({ type: 'float', default: 0 })
  value: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'owner_email' })
  ownerEmail: string | null;

  @Column({ type: 'boolean', default: false, name: 'auto_renew' })
  autoRenew: boolean;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'start_date' })
  startDate: Date | null;

  @Index()
  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'end_date' })
  endDate: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
