import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';

/**
 * Station layout (Industrial Engineering): for a given model + revision, what is
 * assembled at each station of a line, in what order, with which part, how much
 * of it per unit (use factor → drives backflush), the standard time, the feeder
 * position, the work-instruction (visual aid) and whether it is a critical
 * characteristic (CTQ).
 *
 * Table is prefixed `sf_` (shop floor) to avoid colliding with legacy tables.
 * Denormalized model/line/station strings keep this additive and decoupled.
 */
@Entity('sf_line_stations')
@Index('idx_sf_station_scope', ['tenant_id', 'plant_id', 'model', 'revision'])
@Index('idx_sf_station_line', ['line'])
export class SfLineStation extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  model: string;

  @Column({ type: 'varchar', length: 16, default: 'A' })
  revision: string;

  @Index()
  @Column({ type: 'varchar', length: 32 })
  line: string;

  @Column({ type: 'varchar', length: 32 })
  station: string;

  /** Order of the station in the routing. */
  @Column({ type: 'int', default: 1 })
  sequence: number;

  /** Expected part number consumed at this station — the poka-yoke key. */
  @Column({ type: 'varchar', length: 64, nullable: true, name: 'np_expected' })
  npExpected: string | null;

  /** Quantity of npExpected per finished unit (supports fractions). */
  @Column({ type: 'float', default: 1, name: 'use_factor' })
  useFactor: number;

  /** Standard time per unit at this station, in seconds. */
  @Column({ type: 'float', default: 0, name: 'std_time_sec' })
  stdTimeSec: number;

  @Column({
    type: 'varchar',
    length: 48,
    nullable: true,
    name: 'feeder_position',
  })
  feederPosition: string | null;

  @Column({
    type: 'varchar',
    length: 512,
    nullable: true,
    name: 'visual_aid_url',
  })
  visualAidUrl: string | null;

  /** Critical-to-quality characteristic flag. */
  @Column({ type: 'boolean', default: false })
  ctq: boolean;

  @Column({ type: 'varchar', length: 64, nullable: true, name: 'program_id' })
  programId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  notes: string | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  // ── 2D layout (physical placement on the line/cell floor) ──────────────────
  // Additive, nullable: a station's position on the visual layout editor. NULL =
  // "not yet placed" (the station still lives in the list/balance untouched).
  // These coordinates are physical (x/y/size/rotation in the layout's unit) and
  // are independent from the logical `bay_layouts` (NP→bahía) assignment.
  @Column({ type: 'float', nullable: true, name: 'layout_x' })
  layoutX: number | null;

  @Column({ type: 'float', nullable: true, name: 'layout_y' })
  layoutY: number | null;

  @Column({ type: 'float', nullable: true, name: 'layout_w' })
  layoutW: number | null;

  @Column({ type: 'float', nullable: true, name: 'layout_h' })
  layoutH: number | null;

  /** Rotation in degrees (clockwise). */
  @Column({ type: 'float', nullable: true, name: 'layout_rotation' })
  layoutRotation: number | null;
}
