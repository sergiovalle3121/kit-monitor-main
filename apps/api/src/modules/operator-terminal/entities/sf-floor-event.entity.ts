import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';

export type FloorEventType =
  | 'ANDON_MATERIAL'
  | 'ANDON_QUALITY'
  | 'ANDON_MACHINE'
  | 'ANDON_HELP'
  | 'ANDON_SAFETY'
  | 'DEFECT'
  | 'DOWNTIME';

export type FloorEventStatus = 'OPEN' | 'ACK' | 'RESOLVED' | 'CANCELLED';

/**
 * A floor signal raised from a station (Block D + G): an andon call, a reported
 * defect, or a downtime/stop. Routed to the right role, escalates by time, and
 * (for machine andons / downtime) tied to OEE. Prefixed table.
 */
@Entity('sf_floor_events')
@Index('idx_sf_floor_scope_status', ['tenant_id', 'plant_id', 'status'])
@Index('idx_sf_floor_line', ['line', 'status'])
export class SfFloorEvent extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 20 })
  type: FloorEventType;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'wo_id' })
  woId: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true, name: 'wo_folio' })
  woFolio: string | null;

  @Index()
  @Column({ type: 'varchar', length: 32, nullable: true })
  line: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  station: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  model: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  part: string | null;

  @Column({ type: 'varchar', length: 8, default: 'MEDIUM' })
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @Column({ type: 'varchar', length: 16, default: 'OPEN' })
  status: FloorEventStatus;

  /** Role expected to respond (materialist / maintenance / supervisor / quality). */
  @Column({ type: 'varchar', length: 32, nullable: true, name: 'target_role' })
  targetRole: string | null;

  @Column({ type: 'int', default: 0, name: 'escalation_level' })
  escalationLevel: number;

  @Column({ type: 'varchar', length: 32, nullable: true, name: 'downtime_code' })
  downtimeCode: string | null;

  @Column({ type: 'float', default: 0, name: 'downtime_minutes' })
  downtimeMinutes: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'raised_at' })
  raisedAt: Date | null;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'raised_by' })
  raisedBy: string | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'acknowledged_at' })
  acknowledgedAt: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'resolved_at' })
  resolvedAt: Date | null;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'resolved_by' })
  resolvedBy: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true, name: 'program_id' })
  programId: string | null;
}
