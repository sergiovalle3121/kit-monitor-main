import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';
import type {
  AppointmentDirection,
  AppointmentStatus,
} from '../traffic-appointment.rules';

/**
 * Dock appointment (Cita de andén) — the scheduled-arrival + gate log for the
 * yard. Additive, tenant-scoped table `traffic_dock_appointments`. Plans which
 * carrier/unit/driver is expected at which dock and when, and records the gate
 * in/out (`arrivedAt` / `completedAt`). References the outbound shipment by
 * id/folio (`shipmentRef`) only — no FK, no coupling with outbound. Denormalized
 * names so the cita survives a master edit.
 */
@Entity('traffic_dock_appointments')
@Index('idx_traffic_appt_scope', ['tenant_id', 'plant_id'])
export class DockAppointment extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 16, default: 'outbound' })
  direction: AppointmentDirection;

  @Index()
  @Column({ type: DATE_COLUMN_TYPE, name: 'scheduled_at' })
  scheduledAt: Date;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'window_end' })
  windowEnd: Date | null;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true, name: 'dock_id' })
  dockId: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true, name: 'dock_code' })
  dockCode: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'carrier_id' })
  carrierId: string | null;

  @Column({
    type: 'varchar',
    length: 160,
    nullable: true,
    name: 'carrier_name',
  })
  carrierName: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'vehicle_id' })
  vehicleId: string | null;

  @Column({
    type: 'varchar',
    length: 32,
    nullable: true,
    name: 'vehicle_plate',
  })
  vehiclePlate: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'driver_id' })
  driverId: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true, name: 'driver_name' })
  driverName: string | null;

  /** Outbound shipment reference (id or folio) — reference only, no FK. */
  @Column({ type: 'varchar', length: 64, nullable: true, name: 'shipment_ref' })
  shipmentRef: string | null;

  @Column({ type: 'varchar', length: 16, default: 'scheduled' })
  status: AppointmentStatus;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'arrived_at' })
  arrivedAt: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'completed_at' })
  completedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
