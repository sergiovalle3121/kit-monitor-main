import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import type { BomNodeStatus } from '../bom-state';

/**
 * BomNode — the multi-level BOM HEADER for ONE assembly material + revision.
 * Its lines reference child materials from the master; a child that is itself an
 * assembly carries its OWN BomNode, so explosion recurses → real N-level BOMs.
 *
 * Linked to the material master by `materialId` (the assembly we build). New
 * prefixed table (`bom_node`), additive, tenant-scoped.
 */
@Entity('bom_node')
@Index('uq_bom_node_scope_material_rev', ['tenant_id', 'plant_id', 'materialId', 'revision'], { unique: true })
@Index('idx_bom_node_scope_status', ['tenant_id', 'plant_id', 'status'])
export class BomNode extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The assembly material this BOM is for (FK → mm_material). */
  @Index()
  @Column({ type: 'uuid', name: 'material_id' })
  materialId: string;

  @Column({ type: 'varchar', length: 20, default: '1.0' })
  revision: string;

  @Column({ type: 'varchar', length: 16, default: 'DRAFT' })
  status: BomNodeStatus;

  /** Quantity of the assembly this BOM is defined for (usually 1). */
  @Column({ type: 'float', name: 'base_quantity', default: 1 })
  baseQuantity: number;

  @Column({ type: 'varchar', length: 16, name: 'base_uom', default: 'EA' })
  baseUom: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, any> | null;
}
