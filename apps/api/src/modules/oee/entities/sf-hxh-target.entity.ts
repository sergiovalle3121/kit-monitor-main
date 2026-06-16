import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';

/**
 * Hour-by-hour production target for a line/shift/hour (Block H). The manager
 * sets the meta; the REAL is DERIVED from the existing consumption (advance)
 * events — never stored here, never double-counted.
 *
 * `effectiveDate` (YYYY-MM-DD) is an optional per-day override; a row with a NULL
 * effectiveDate is the standing template that applies to every day for that
 * line/shift/hour. New, additive, prefixed table (`sf_`).
 */
@Entity('sf_hxh_target')
@Index('idx_sf_hxh_scope', ['tenant_id', 'plant_id', 'line'])
@Index('idx_sf_hxh_line_shift', ['line', 'shift'])
export class SfHxhTarget extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 32 })
  line: string;

  @Column({ type: 'varchar', length: 16, default: 'A' })
  shift: string;

  /** Hour of day, 0–23. */
  @Column({ type: 'int' })
  hour: number;

  @Column({ type: 'int', default: 0, name: 'target_qty' })
  targetQty: number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  model: string | null;

  /** YYYY-MM-DD per-day override; NULL = standing template for every day. */
  @Column({
    type: 'varchar',
    length: 10,
    nullable: true,
    name: 'effective_date',
  })
  effectiveDate: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  notes: string | null;
}
