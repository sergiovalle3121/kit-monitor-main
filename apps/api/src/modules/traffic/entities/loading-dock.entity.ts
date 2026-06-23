import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';
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

  // ── Operational state (Tablero de andenes) ─────────────────────────────────
  // Additive, nullable yard-cockpit fields. The poka-yoke `status` above is the
  // master/assignment vocabulary (available/occupied/maintenance/inactive);
  // these power the live dock board without altering that contract. `occupiedAt`
  // starts the aging clock the moment the door is taken (by the outbound
  // transport assignment, which flips status→occupied through setDockStatus);
  // `loadingStartedAt` marks the EN CARGA sub-state. Both clear on release.
  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'occupied_at' })
  occupiedAt: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'loading_started_at' })
  loadingStartedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
