import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';

export type MeasurementSource = 'FINAL_INSPECTION' | 'STATION' | 'MANUAL';

/**
 * QualityMeasurement — the common reading entity SPC will consume.
 *
 * One numeric reading (variables) or pass/fail (attributes) captured against a
 * CTQ (`qc_characteristics`). Readings can be grouped into subgroups/samples so
 * the later SPC PR can build X̄-R / I-MR charts; for now we only persist and
 * summarize descriptively.
 *
 * Index design is intentional: the SPC PR queries "all readings for THIS
 * characteristic ordered by time", so `(characteristic_id, measured_at)` is the
 * hot path, plus a tenant-scoped variant for isolation.
 */
@Entity('qc_measurements')
@Index('idx_qc_meas_char_time', ['characteristicId', 'measuredAt'])
@Index('idx_qc_meas_scope_char_time', ['tenant_id', 'characteristicId', 'measuredAt'])
@Index('idx_qc_meas_subgroup', ['characteristicId', 'subgroupId'])
export class QualityMeasurement extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** CTQ this reading belongs to (`qc_characteristics.id`). */
  @Column({ type: 'varchar', length: 36, name: 'characteristic_id' })
  characteristicId: string;

  /** Measured value for VARIABLE characteristics. */
  @Column({ type: 'double precision', nullable: true })
  value: number | null;

  /** Pass/fail outcome for ATTRIBUTE characteristics. */
  @Column({ type: 'boolean', nullable: true })
  passed: boolean | null;

  /** Subgroup/sample key to group readings taken together. */
  @Column({ type: 'varchar', length: 64, nullable: true, name: 'subgroup_id' })
  subgroupId: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true, name: 'subgroup_label' })
  subgroupLabel: string | null;

  @Index()
  @Column({ type: DATE_COLUMN_TYPE, name: 'measured_at', default: () => 'CURRENT_TIMESTAMP' })
  measuredAt: Date;

  @Column({ type: 'varchar', length: 120, nullable: true, name: 'measured_by' })
  measuredBy: string | null;

  @Column({ type: 'varchar', length: 24, default: 'MANUAL' })
  source: MeasurementSource;

  /** WO / serial / lot the reading traces back to. */
  @Column({ type: 'varchar', length: 120, nullable: true })
  reference: string | null;

  /** Instrument/gage id — reserved for future metrology (MSA) traceability. */
  @Column({ type: 'varchar', length: 120, nullable: true })
  gage: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
