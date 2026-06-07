import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';
import type { Disposition, HoldStatus } from '../hold-state';

export type HoldOrigin = 'IQC' | 'IN_PROCESS' | 'OQC';

/**
 * A quality hold / NCR (Block F). Captures a reject (origin IQC / in-process /
 * OQC), quarantines the lot/serial (blocking consumption & shipment), and runs the
 * MRB state machine to a disposition. Reuses the central NCR folio. Prefixed table.
 */
@Entity('sf_quality_holds')
@Index('idx_sf_hold_scope_status', ['tenant_id', 'plant_id', 'status'])
@Index('idx_sf_hold_part_lot', ['part', 'lot'])
export class SfQualityHold extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 32, nullable: true })
  folio: string | null;

  @Column({ type: 'varchar', length: 12, default: 'IN_PROCESS' })
  origin: HoldOrigin;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  part: string;

  @Column({ type: 'float', default: 0 })
  qty: number;

  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true })
  lot: string | null;

  @Index()
  @Column({ type: 'varchar', length: 80, nullable: true })
  serial: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'wo_id' })
  woId: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true, name: 'wo_folio' })
  woFolio: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  station: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true, name: 'defect_type' })
  defectType: string | null;

  @Column({ type: 'varchar', length: 8, default: 'MEDIUM' })
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @Column({ type: 'varchar', length: 512, nullable: true, name: 'photo_url' })
  photoUrl: string | null;

  @Column({ type: 'varchar', length: 16, default: 'HELD' })
  status: HoldStatus;

  @Column({ type: 'varchar', length: 12, nullable: true })
  disposition: Disposition | null;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'disposition_notes' })
  dispositionNotes: string | null;

  /** Deviation/waiver reference for USE_AS_IS. */
  @Column({ type: 'varchar', length: 120, nullable: true })
  waiver: string | null;

  /** SCAR / debit-note reference for RTV. */
  @Column({ type: 'varchar', length: 120, nullable: true, name: 'scar_ref' })
  scarRef: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'signed_by' })
  signedBy: string | null;

  @Column({ type: 'float', default: 0, name: 'scrap_qty' })
  scrapQty: number;

  @Column({ type: 'float', default: 0, name: 'rework_hours' })
  reworkHours: number;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'raised_by' })
  raisedBy: string | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'raised_at' })
  raisedAt: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'dispositioned_at' })
  dispositionedAt: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'closed_at' })
  closedAt: Date | null;

  @Column({ type: 'varchar', length: 64, nullable: true, name: 'program_id' })
  programId: string | null;
}
