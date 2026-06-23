import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { JSON_COLUMN_TYPE } from '../../../common/database/json-column-type';
import type { ReadinessCriterion, ReadinessSignals } from '../npi.readiness';

/**
 * NpiReadinessSnapshot — an immutable, point-in-time capture of a model's
 * readiness verdict, so the live (otherwise ephemeral) derivation gains a
 * history/audit trail and a trend. Written on gate decisions, the scheduled
 * scan, model activation, or on demand. ADVISORY: it records, it never gates.
 *
 * Fully ADDITIVE prefixed table (`npi_`). Links to a project/model by id/number
 * (varchar, no FK constraints). Pure record — never mutated after insert.
 */
@Entity('npi_readiness_snapshot')
@Index('idx_npi_snapshot_scope_model', [
  'tenant_id',
  'plant_id',
  'modelNumber',
  'revision',
])
@Index('idx_npi_snapshot_project', ['projectId'])
export class NpiReadinessSnapshot extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The NpiProject this snapshot belongs to, when taken in project context. */
  @Column({ type: 'varchar', length: 36, nullable: true, name: 'project_id' })
  projectId: string | null;

  @Index()
  @Column({ type: 'varchar', length: 40, name: 'model_number' })
  modelNumber: string;

  @Column({ type: 'varchar', length: 20, default: '1.0' })
  revision: string;

  /** Phase context when the snapshot was taken (advisory). */
  @Column({ type: 'varchar', length: 16, nullable: true })
  phase: string | null;

  /** Why it was captured: GATE_DECISION | SCAN | MANUAL | PROJECT_CREATED | MODEL_ACTIVATION. */
  @Column({ type: 'varchar', length: 24, default: 'MANUAL' })
  reason: string;

  @Column({ type: 'boolean', default: false, name: 'gate_ready' })
  gateReady: boolean;

  @Column({ type: 'int', default: 0, name: 'ready_count' })
  readyCount: number;

  @Column({ type: 'int', default: 0, name: 'not_ready_count' })
  notReadyCount: number;

  @Column({ type: 'int', default: 0, name: 'unknown_count' })
  unknownCount: number;

  /** The full per-criterion verdict at capture time. */
  @Column({ type: JSON_COLUMN_TYPE, nullable: true })
  criteria: ReadinessCriterion[] | null;

  /** The raw resolved signals at capture time. */
  @Column({ type: JSON_COLUMN_TYPE, nullable: true })
  signals: ReadinessSignals | null;

  /** Criterion keys that were NOT_READY (the blockers). */
  @Column({ type: JSON_COLUMN_TYPE, nullable: true })
  blockers: string[] | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;
}
