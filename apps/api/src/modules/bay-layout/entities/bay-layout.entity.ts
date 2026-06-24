import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

/**
 * Distribución logística de NP por bahía.
 * Define en qué bahía (1–6) se coloca cada partNumber de un modelo.
 * No afecta consumo ni BOM maestro — es configuración de layout físico.
 */
@Entity('bay_layouts')
@Index(['model', 'partNumber', 'bahia'], { unique: true })
export class BayLayout {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'tenant_id' })
  tenant_id: string | null;

  @Column()
  @Index()
  model: string; // matches BomItem.model / Plan.model

  @Column()
  partNumber: string; // matches BomItem.partNumber

  @Column({ type: 'int' })
  bahia: number; // 1–6

  @Column({ type: 'int', nullable: true })
  minStock: number; // Stock mínimo / Punto de reorden manual
}
