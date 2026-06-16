import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import type { VehicleStatus, VehicleType } from '../traffic.rules';

/**
 * Vehicle / unit (Unidad) master. The structured replacement for the free-string
 * `truckPlate`. Carries the data traffic needs to assign a unit to a shipment
 * (plate, económico, type, capacity) and the operational `status` that gates the
 * assignment poka-yoke. Optionally tied to a carrier (denormalized name).
 */
@Entity('traffic_vehicles')
@Index('idx_traffic_vehicle_scope', ['tenant_id', 'plant_id'])
export class Vehicle extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 32 })
  plate: string;

  @Column({ type: 'varchar', length: 32, nullable: true, name: 'economic_number' })
  economicNumber: string | null;

  @Column({ type: 'varchar', length: 24, default: 'DRY_VAN' })
  type: VehicleType;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true, name: 'carrier_id' })
  carrierId: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true, name: 'carrier_name' })
  carrierName: string | null;

  @Column({ type: 'float', nullable: true, name: 'max_weight_kg' })
  maxWeightKg: number | null;

  @Column({ type: 'float', nullable: true, name: 'max_volume_m3' })
  maxVolumeM3: number | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  vin: string | null;

  @Column({ type: 'varchar', length: 16, default: 'available' })
  status: VehicleStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
