import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import type { NpiPhase, NpiProjectStatus } from '../npi-state';

/**
 * NpiProject — an additive orchestration record for introducing one
 * model+revision through the phase-gate funnel (QUOTE→…→MP).
 *
 * Fully ADDITIVE: brand-new prefixed table (`npi_`), every column nullable or
 * defaulted. It references the model by its number (varchar, no FK constraint to
 * `pm_product_models`) so it never couples to — nor mutates — product-models.
 * Readiness is derived live and is advisory only.
 */
@Entity('npi_project')
@Index(
  'uq_npi_project_scope_model_rev',
  ['tenant_id', 'plant_id', 'modelNumber', 'revision'],
  { unique: true },
)
@Index('idx_npi_project_scope_status', ['tenant_id', 'plant_id', 'status'])
export class NpiProject extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The model this NPI tracks (matches ProductModel.modelNumber; no FK). */
  @Index()
  @Column({ type: 'varchar', length: 40, name: 'model_number' })
  modelNumber: string;

  @Column({ type: 'varchar', length: 20, default: '1.0' })
  revision: string;

  @Column({ type: 'varchar', length: 160, nullable: true })
  customer: string | null;

  /** Current phase in the funnel (advisory pointer). */
  @Column({
    type: 'varchar',
    length: 16,
    default: 'QUOTE',
    name: 'current_phase',
  })
  currentPhase: NpiPhase;

  @Column({ type: 'varchar', length: 16, default: 'OPEN' })
  status: NpiProjectStatus;

  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true, name: 'program_id' })
  programId: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes: string | null;
}
