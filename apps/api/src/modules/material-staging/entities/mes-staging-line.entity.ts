import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';

/** Lane-1 staging status for a kitter pick-list line. */
export type MesStagingStatus = 'PENDING' | 'STAGED' | 'SHORTAGE';

/**
 * Carril 1 (puente MES) — estado de surtido del kitteador para los PLANES
 * publicados (plans → pick-list por planId). Vive en su PROPIA tabla
 * (`sf_mes_staging`), separada del carril 2 (`sf_staging`), para que jubilar el
 * puente (Forma 2) sea BORRAR, no desenredar.
 *
 * Una fila por (plan, línea del pick-list = kit_materials.id). El kitteador marca
 * la línea como SURTIDO aquí; NUNCA reescribe el kit / pick-list que lee el
 * operador MES, así que abrir y consumir la WO en /operador no se ve afectado.
 */
@Entity('sf_mes_staging')
@Index('idx_sf_mes_staging_plan', ['planId'])
@Index('idx_sf_mes_staging_scope', ['tenant_id', 'plant_id', 'planId'])
@Index('idx_sf_mes_staging_line', ['planId', 'kitMaterialId'])
export class MesStagingLine extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', name: 'plan_id' })
  planId: number;

  @Column({ type: 'varchar', length: 64, nullable: true, name: 'work_order' })
  workOrder: string | null;

  /** The pick-list line (kit_materials.id) this staging row tracks. */
  @Column({ type: 'int', nullable: true, name: 'kit_material_id' })
  kitMaterialId: number | null;

  @Column({ type: 'varchar', length: 120 })
  part: string;

  @Column({ type: 'float', default: 0, name: 'required_qty' })
  requiredQty: number;

  @Column({ type: 'float', default: 0, name: 'staged_qty' })
  stagedQty: number;

  @Column({ type: 'varchar', length: 16, default: 'PENDING' })
  status: MesStagingStatus;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'staged_at' })
  stagedAt: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'staged_by' })
  stagedBy: string | null;
}
