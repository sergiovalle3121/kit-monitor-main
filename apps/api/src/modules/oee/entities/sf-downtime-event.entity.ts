import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';
import type { DowntimeReason } from '../oee';

export type DowntimeStatus = 'OPEN' | 'CLOSED';

/**
 * A line/station stop with a categorised reason (Block H/G). Opened when a line
 * goes down and closed when it comes back; `durationMinutes` is derived on close
 * (or live, against now, while still OPEN) and feeds OEE Availability.
 *
 * New, additive, prefixed table (`sf_`). Decoupled by denormalized line/WO
 * strings like the rest of the shop-floor suite.
 */
@Entity('sf_downtime_events')
@Index('idx_sf_downtime_scope_status', ['tenant_id', 'plant_id', 'status'])
@Index('idx_sf_downtime_line_status', ['line', 'status'])
export class SfDowntimeEvent extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 32 })
  line: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  station: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'wo_id' })
  woId: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true, name: 'wo_folio' })
  woFolio: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  model: string | null;

  /** EQUIPMENT | MATERIAL | QUALITY | CHANGEOVER | NO_OPERATOR | OTHER. */
  @Index()
  @Column({
    type: 'varchar',
    length: 16,
    name: 'reason_code',
    default: 'OTHER',
  })
  reasonCode: DowntimeReason;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'reason_note' })
  reasonNote: string | null;

  @Column({ type: 'varchar', length: 8, default: 'OPEN' })
  status: DowntimeStatus;

  @Column({ type: DATE_COLUMN_TYPE, name: 'start_at' })
  startAt: Date;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'end_at' })
  endAt: Date | null;

  /** Derived on close (= end − start), in minutes. */
  @Column({ type: 'float', default: 0, name: 'duration_minutes' })
  durationMinutes: number;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'opened_by' })
  openedBy: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'closed_by' })
  closedBy: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true, name: 'program_id' })
  programId: string | null;
}
