import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import type { StagingStatus } from '../staging-status';

/**
 * One staged material line for a work order at a station (Block C). The
 * materialist confirms staged quantity against the required (use factor × WO qty)
 * per station; shortages block readiness. `stagedQty` is decremented live by the
 * operator terminal's backflush; when it drops under `minQty` an e-kanban
 * replenishment call fires automatically.
 */
@Entity('sf_staging')
@Index('idx_sf_staging_wo', ['woId'])
@Index('idx_sf_staging_scope', ['tenant_id', 'plant_id', 'status'])
export class SfStaging extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 36, name: 'wo_id' })
  woId: string;

  @Column({ type: 'varchar', length: 32, nullable: true, name: 'wo_folio' })
  woFolio: string | null;

  @Column({ type: 'varchar', length: 64 })
  model: string;

  @Column({ type: 'varchar', length: 32 })
  station: string;

  @Column({ type: 'int', default: 1 })
  sequence: number;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  part: string;

  @Column({ type: 'float', default: 0, name: 'required_qty' })
  requiredQty: number;

  @Column({ type: 'float', default: 0, name: 'staged_qty' })
  stagedQty: number;

  /** Kanban reorder point: when staged_qty drops to/under this, fire a call. */
  @Column({ type: 'float', default: 0, name: 'min_qty' })
  minQty: number;

  @Column({ type: 'varchar', length: 16, default: 'PENDING' })
  status: StagingStatus;

  @Column({ type: 'varchar', length: 48, nullable: true, name: 'feeder_position' })
  feederPosition: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true, name: 'program_id' })
  programId: string | null;
}
