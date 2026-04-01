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

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'float' })
  quantityRequired: number; // calculated: BomItem.usageFactor × Plan.quantity

  @Column({ type: 'float', nullable: true })
  quantityActual: number; // what was physically included

  @Column({ default: 'EA' })
  unit: string;
}
