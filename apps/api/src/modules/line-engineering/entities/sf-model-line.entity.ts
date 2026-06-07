import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';

/**
 * Model↔Line qualification: which models may run on which line, the changeover
 * time required to switch the line to this model, and the takt target. This is
 * the master record an Industrial Engineer maintains before a model can be
 * planned/run on a line.
 */
@Entity('sf_model_lines')
@Index('idx_sf_modelline_scope', ['tenant_id', 'plant_id', 'model', 'line'])
export class SfModelLine extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  model: string;

  @Column({ type: 'varchar', length: 16, default: 'A' })
  revision: string;

  @Index()
  @Column({ type: 'varchar', length: 32 })
  line: string;

  /** Minutes to change the line over to this model (SMED target). */
  @Column({ type: 'float', default: 0, name: 'changeover_minutes' })
  changeoverMinutes: number;

  /** Target takt time per unit in seconds (0 = derive from demand). */
  @Column({ type: 'float', default: 0, name: 'takt_target_sec' })
  taktTargetSec: number;

  @Column({ type: 'varchar', length: 64, nullable: true, name: 'program_id' })
  programId: string | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  notes: string | null;
}
