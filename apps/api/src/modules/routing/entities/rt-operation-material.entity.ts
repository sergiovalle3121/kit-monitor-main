import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';

/**
 * RtOperationMaterial — the link between an operation and the materials consumed
 * at it (the BOM ↔ routing bridge). Drives CORRECT backflush: confirming N units
 * at this operation consumes qtyPerUnit × N of this material.
 *
 * References the material master (`materialId`) and, optionally, the specific BOM
 * line (`bomLineId`). New prefixed table (`rt_operation_material`), additive.
 */
@Entity('rt_operation_material')
@Index('idx_rt_opmat_operation', ['tenant_id', 'operationId'])
@Index('idx_rt_opmat_material', ['tenant_id', 'materialId'])
export class RtOperationMaterial extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid', name: 'operation_id' })
  operationId: string;

  /** Component consumed (FK → mm_material). */
  @Index()
  @Column({ type: 'uuid', name: 'material_id' })
  materialId: string;

  /** Optional link to the BOM line this consumption corresponds to. */
  @Column({ type: 'uuid', nullable: true, name: 'bom_line_id' })
  bomLineId: string | null;

  /** Quantity consumed per finished unit at this operation. */
  @Column({ type: 'float', name: 'qty_per_unit', default: 1 })
  qtyPerUnit: number;

  @Column({ type: 'varchar', length: 16, default: 'EA' })
  uom: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
