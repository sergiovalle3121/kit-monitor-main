import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';

export type CharacteristicType = 'VARIABLE' | 'ATTRIBUTE';

/**
 * QualityCharacteristic — the CTQ (Critical-To-Quality) catalog entry.
 *
 * The DATA FOUNDATION for SPC: a quality/process engineer defines WHAT gets
 * measured on a model (nominal, USL, LSL, unit) — typically straight from the
 * control plan. Measurements (`qc_measurements`) are captured against these
 * rows, and a LATER PR will draw control charts / Cpk on top. Nothing here is
 * SPC itself; this is the spec the rest of SPC needs in order to exist.
 *
 * Fully additive, prefixed table (`qc_`). Links to the canonical product model
 * (`pm_product_models.id`) by id; nullable for plant-wide characteristics.
 */
@Entity('qc_characteristics')
@Index('idx_qc_char_scope_model', ['tenant_id', 'plant_id', 'modelId'])
@Index('idx_qc_char_scope_active', ['tenant_id', 'plant_id', 'active'])
export class QualityCharacteristic extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Short code/folio (e.g. CTQ-00001 or an engineer-supplied code). */
  @Index()
  @Column({ type: 'varchar', length: 40 })
  code: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  /** Canonical product model id (`pm_product_models.id`); null = general CTQ. */
  @Column({ type: 'varchar', length: 36, nullable: true, name: 'model_id' })
  modelId: string | null;

  /** Optional link to a routing operation/station (`rt_operation.id`). */
  @Column({ type: 'varchar', length: 36, nullable: true, name: 'operation_id' })
  operationId: string | null;

  /** Free-text station label when no formal operation id applies. */
  @Column({ type: 'varchar', length: 120, nullable: true })
  station: string | null;

  @Column({ type: 'varchar', length: 16, default: 'VARIABLE' })
  type: CharacteristicType;

  /** Unit of measure for variables (mm, V, g…); null for attributes. */
  @Column({ type: 'varchar', length: 24, nullable: true })
  unit: string | null;

  @Column({ type: 'double precision', nullable: true })
  nominal: number | null;

  /** Upper specification limit. */
  @Column({ type: 'double precision', nullable: true })
  usl: number | null;

  /** Lower specification limit. */
  @Column({ type: 'double precision', nullable: true })
  lsl: number | null;

  @Column({ type: 'boolean', default: true, name: 'is_critical' })
  isCritical: boolean;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
