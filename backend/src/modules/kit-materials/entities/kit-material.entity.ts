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
  quantityRequired: number; // BomItem.usageFactor × Plan.quantity

  @Column({ type: 'float', nullable: true })
  quantityActual: number; // physically included (manual override)

  @Column({ type: 'float', nullable: true })
  quantityConsumed: number; // updated after each advance: usageFactor × totalCompleted

  @Column({ type: 'float', nullable: true })
  quantityRemaining: number; // quantityRequired − quantityConsumed

  @Column({ default: 'EA' })
  unit: string;
}
