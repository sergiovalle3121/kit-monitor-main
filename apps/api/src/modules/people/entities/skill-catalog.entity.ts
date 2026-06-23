import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';

/**
 * Catálogo formal de skills / certificaciones (RH). Reemplaza el texto libre por
 * un vocabulario curado: cada skill tiene categoría, área sugerida y una vigencia
 * por defecto (meses) que auto-calcula el vencimiento al certificar. Aditivo y
 * autocontenido — las certificaciones siguen guardando el nombre denormalizado,
 * así que el catálogo es opcional y no rompe datos viejos.
 */
@Entity('skill_catalog')
@Index('idx_skill_catalog_scope', ['tenant_id', 'plant_id', 'active'])
export class SkillCatalog extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  category: string | null;

  /** Área sugerida (prefilla el alta de certificación). */
  @Column({ type: 'varchar', length: 120, nullable: true })
  area: string | null;

  /** Vigencia por defecto en meses → auto-calcula expiry al emitir la cert. */
  @Column({ type: 'int', nullable: true, name: 'default_validity_months' })
  defaultValidityMonths: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;
}
