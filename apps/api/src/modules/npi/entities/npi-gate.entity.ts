import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';
import type { NpiGateStatus, NpiPhase } from '../npi-state';

/**
 * NpiGate — one phase gate of an NpiProject. The project owns one gate per phase
 * (QUOTE→…→MP); each is decided PENDING → PASSED/FAILED/WAIVED.
 *
 * Fully ADDITIVE prefixed table (`npi_`). Links to its project by id (varchar,
 * no FK constraint) so it stays decoupled. Passing the final (MP) gate pushes an
 * advisory inbox alert — it never activates the model.
 */
@Entity('npi_gate')
@Index('idx_npi_gate_scope_project', ['tenant_id', 'plant_id', 'projectId'])
@Index('idx_npi_gate_project_phase', ['projectId', 'phase'])
export class NpiGate extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The owning NpiProject (denormalized id; no FK constraint). */
  @Index()
  @Column({ type: 'varchar', length: 36, name: 'project_id' })
  projectId: string;

  @Column({ type: 'varchar', length: 16 })
  phase: NpiPhase;

  @Column({ type: 'varchar', length: 16, default: 'PENDING' })
  status: NpiGateStatus;

  @Column({
    type: 'varchar',
    length: 200,
    nullable: true,
    name: 'decided_by_email',
  })
  decidedByEmail: string | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'decided_at' })
  decidedAt: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes: string | null;
}
