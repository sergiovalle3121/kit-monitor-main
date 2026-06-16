import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';
import { JSON_COLUMN_TYPE } from '../../../common/database/json-column-type';
import type {
  ChangeoverChecklistItem,
  ChangeoverStatus,
} from '../changeover-state';

/**
 * Changeover / SMED event (block changeover). A model-to-model setup on a line:
 * a setup checklist + a stopwatch measuring the changeover time, tied to the
 * WO/model transition on the line. The measured time is recorded as downtime of
 * category 'changeover' (B1 OEE contract) via the event ledger; `downtimeReported`
 * is the seam a future B1 line-keyed downtime endpoint can consume.
 *
 * Table prefixed `sf_` (additive, no collision with legacy tables). Decoupled from
 * the WO/model by denormalized strings, like the rest of the shop-floor suite.
 */
@Entity('sf_changeovers')
@Index('idx_sf_changeover_scope_status', ['tenant_id', 'plant_id', 'status'])
@Index('idx_sf_changeover_line', ['line', 'status'])
export class SfChangeover extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 32, nullable: true })
  folio: string | null;

  @Index()
  @Column({ type: 'varchar', length: 32 })
  line: string;

  /** Model being torn down (outgoing). */
  @Column({ type: 'varchar', length: 64, nullable: true, name: 'from_model' })
  fromModel: string | null;

  /** Model being set up (incoming). */
  @Column({ type: 'varchar', length: 64, nullable: true, name: 'to_model' })
  toModel: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'from_wo_id' })
  fromWoId: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'to_wo_id' })
  toWoId: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true, name: 'to_wo_folio' })
  toWoFolio: string | null;

  @Column({ type: 'varchar', length: 16, default: 'OPEN' })
  status: ChangeoverStatus;

  /** Setup checklist (SMED steps). */
  @Column({ type: JSON_COLUMN_TYPE, nullable: true })
  checklist: ChangeoverChecklistItem[] | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'started_at' })
  startedAt: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'completed_at' })
  completedAt: Date | null;

  /** Measured changeover time (seconds) — start→complete. */
  @Column({ type: 'int', nullable: true, name: 'duration_sec' })
  durationSec: number | null;

  /** SMED target (minutes) carried from the model↔line qualification. */
  @Column({ type: 'float', default: 0, name: 'target_minutes' })
  targetMinutes: number;

  /** Downtime category for the OEE/availability contract (B1). */
  @Column({
    type: 'varchar',
    length: 24,
    default: 'changeover',
    name: 'downtime_category',
  })
  downtimeCategory: string;

  /** Set once the changeover time has been published as downtime. */
  @Column({ type: 'boolean', default: false, name: 'downtime_reported' })
  downtimeReported: boolean;

  @Column({ type: 'varchar', length: 200, nullable: true })
  operator: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true, name: 'program_id' })
  programId: string | null;
}
