import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import type { DockStatus, DockType } from '../traffic.rules';

/**
 * Loading dock / door (Andén) master. Structured replacement for the free-string
 * `dockNumber`. Optionally tied to an enterprise building (denormalized name).
 * `type` (shipping/receiving/both) + `status` gate the assignment poka-yoke so a
 * receiving-only or out-of-service door cannot be tied to an outbound shipment.
 */
@Entity('traffic_docks')
@Index('idx_traffic_dock_scope', ['tenant_id', 'plant_id'])
export class LoadingDock extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 32 })
  code: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  name: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true, name: 'building_id' })
  buildingId: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true, name: 'building_name' })
  buildingName: string | null;

  @Column({ type: 'varchar', length: 16, default: 'shipping' })
  type: DockType;

  @Column({ type: 'varchar', length: 16, default: 'available' })
  status: DockStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
