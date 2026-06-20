import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import type { BomItemCategory } from '../bom-state';

/**
 * BomLine — one component line of a BomNode. The component is ALWAYS a material
 * chosen from the master (FK `materialId`) — never free text. Position uses a
 * find-number (0010, 0020…). Lines that share an `alternateGroup` are alternates
 * at the same position.
 *
 * New prefixed table (`bom_line`), additive, tenant-scoped.
 */
@Entity('bom_line')
@Index('idx_bom_line_node', ['tenant_id', 'bomNodeId'])
@Index('idx_bom_line_material', ['tenant_id', 'materialId'])
export class BomLine extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid', name: 'bom_node_id' })
  bomNodeId: string;

  /** Component material (FK → mm_material). Chosen from the master, never text. */
  @Index()
  @Column({ type: 'uuid', name: 'material_id' })
  materialId: string;

  /** Position / find-number, e.g. 0010, 0020. */
  @Column({ type: 'varchar', length: 12, name: 'find_number', default: '0010' })
  findNumber: string;

  @Column({ type: 'float', default: 1 })
  quantity: number;

  @Column({ type: 'varchar', length: 16, default: 'EA' })
  uom: string;

  /** Reference designators (e.g. R1, C1-C10). */
  @Column({ type: 'varchar', length: 255, nullable: true, name: 'ref_des' })
  refDes: string | null;

  @Column({ type: 'varchar', length: 16, name: 'item_category', default: 'STANDARD' })
  itemCategory: BomItemCategory;

  @Column({ type: 'float', name: 'scrap_pct', default: 0 })
  scrapPct: number;

  /** Optional make/buy override for this usage (else inherits from material). */
  @Column({ type: 'varchar', length: 8, name: 'make_buy', nullable: true })
  makeBuy: string | null;

  /** Phantom at this usage (exploded but not stocked). */
  @Column({ type: 'boolean', default: false })
  phantom: boolean;

  /** Lines with the same group are alternates for the same position. */
  @Column({ type: 'varchar', length: 40, nullable: true, name: 'alternate_group' })
  alternateGroup: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
