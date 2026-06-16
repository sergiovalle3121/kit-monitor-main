import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import type { DriverStatus } from '../traffic.rules';

/**
 * Driver (Chofer / Operador) master. Structured replacement for the free-string
 * `driverName`. Carries the identity data traffic verifies at the gate (license,
 * id document) and the `status` that gates the assignment poka-yoke.
 */
@Entity('traffic_drivers')
@Index('idx_traffic_driver_scope', ['tenant_id', 'plant_id'])
export class Driver extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'varchar', length: 40, nullable: true, name: 'license_number' })
  licenseNumber: string | null;

  @Column({ type: 'varchar', length: 24, nullable: true, name: 'license_type' })
  licenseType: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  phone: string | null;

  /** ID document (INE / credencial) shown at the gate. */
  @Column({ type: 'varchar', length: 40, nullable: true, name: 'id_document' })
  idDocument: string | null;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true, name: 'carrier_id' })
  carrierId: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true, name: 'carrier_name' })
  carrierName: string | null;

  @Column({ type: 'varchar', length: 16, default: 'available' })
  status: DriverStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
