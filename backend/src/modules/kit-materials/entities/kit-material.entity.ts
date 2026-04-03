import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Kit } from '../../kits/entities/kit.entity';

@Entity('kit_materials')
export class KitMaterial {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Kit, (kit) => kit.materials)
  kit: Kit;

  @Column()
  partNumber: string;

  @Column({ type: 'varchar', nullable: true })
  description?: string | null;

  @Column({ type: 'float' })
  quantityRequired: number;

  @Column({ type: 'float', nullable: true })
  quantityActual?: number | null;

  @Column({ type: 'float', default: 0 })
  quantityResupplied: number;

  @Column({ type: 'float', nullable: true })
  quantityConsumed?: number | null;

  @Column({ type: 'float', nullable: true })
  quantityRemaining?: number | null;

  @Column({ default: false })
  isBulkResupply: boolean;

  @Column({ default: 'EA' })
  unit: string;
}
