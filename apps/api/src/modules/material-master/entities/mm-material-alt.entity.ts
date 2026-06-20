import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import type { AlternateType } from '../material-state';

/**
 * MmMaterialAlt — substitutes / alternates BETWEEN materials. A primary part
 * (`materialId`) can be replaced by an alternate part (`altMaterialId`) at a
 * given substitution ratio. ALTERNATE = form-fit-function equal; SUBSTITUTE =
 * conditional replacement.
 *
 * Both ends reference the material master (uuid). Additive, prefixed table.
 */
@Entity('mm_material_alt')
@Index('idx_mm_alt_material', ['tenant_id', 'materialId'])
@Index('uq_mm_alt_pair', ['materialId', 'altMaterialId'], { unique: true })
export class MmMaterialAlt extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid', name: 'material_id' })
  materialId: string;

  @Index()
  @Column({ type: 'uuid', name: 'alt_material_id' })
  altMaterialId: string;

  @Column({ type: 'varchar', length: 16, default: 'ALTERNATE' })
  type: AlternateType;

  /** If true the relation applies both ways (A↔B). */
  @Column({ type: 'boolean', default: true })
  bidirectional: boolean;

  /** Quantity of the alternate per unit of the primary (usually 1). */
  @Column({ type: 'float', default: 1 })
  ratio: number;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
