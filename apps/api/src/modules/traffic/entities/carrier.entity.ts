import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import type { CarrierMode, CarrierStatus } from '../traffic.rules';

/**
 * Carrier (Transportista) master. Replaces the free-string `carrier` that
 * shipments carried. Additive, tenant-scoped table `traffic_carriers`; code is
 * unique within the tenant/plant scope (enforced in the service, not a global DB
 * constraint, to stay multi-tenant safe).
 */
@Entity('traffic_carriers')
@Index('idx_traffic_carrier_scope', ['tenant_id', 'plant_id'])
export class Carrier extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 32 })
  code: string;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  /** Standard Carrier Alpha Code (logística US/EMS). */
  @Column({ type: 'varchar', length: 8, nullable: true })
  scac: string | null;

  /** RFC / tax id. */
  @Column({ type: 'varchar', length: 40, nullable: true, name: 'tax_id' })
  taxId: string | null;

  @Column({ type: 'varchar', length: 16, default: 'GROUND' })
  mode: CarrierMode;

  @Column({ type: 'varchar', length: 120, nullable: true, name: 'contact_name' })
  contactName: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true, name: 'contact_phone' })
  contactPhone: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true, name: 'contact_email' })
  contactEmail: string | null;

  @Column({ type: 'varchar', length: 16, default: 'active' })
  status: CarrierStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
