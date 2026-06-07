import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';

/**
 * An immutable record of a confirmed production/consumption at a station (Block D).
 * Each event backflushes `backflushQty` (= units × use factor) of `part` and
 * increments the WO. `idempotencyKey` is unique so a double-tap / retry never
 * double-counts. `outboxStatus` drives the SAP 261 outbox (stubbed).
 */
@Entity('sf_consumption_events')
@Index('idx_sf_consumption_wo', ['woId'])
@Index('idx_sf_consumption_scope', ['tenant_id', 'plant_id'])
export class SfConsumptionEvent extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 80, name: 'idempotency_key' })
  idempotencyKey: string;

  @Index()
  @Column({ type: 'varchar', length: 36, name: 'wo_id' })
  woId: string;

  @Column({ type: 'varchar', length: 32, nullable: true, name: 'wo_folio' })
  woFolio: string | null;

  @Column({ type: 'varchar', length: 64 })
  model: string;

  @Column({ type: 'varchar', length: 32 })
  station: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  part: string | null;

  /** Finished units produced by this confirmation. */
  @Column({ type: 'float', default: 1 })
  units: number;

  /** Material backflushed (= units × use factor). */
  @Column({ type: 'float', default: 0, name: 'backflush_qty' })
  backflushQty: number;

  /** Optional per-unit serial for genealogy (programs that require it). */
  @Index()
  @Column({ type: 'varchar', length: 80, nullable: true, name: 'unit_serial' })
  unitSerial: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'operator_email' })
  operatorEmail: string | null;

  @Column({ type: 'varchar', length: 16, default: 'PENDING', name: 'outbox_status' })
  outboxStatus: 'PENDING' | 'SENT_STUB' | 'ACK' | 'ERROR';

  @Column({ type: 'varchar', length: 64, nullable: true, name: 'program_id' })
  programId: string | null;
}
