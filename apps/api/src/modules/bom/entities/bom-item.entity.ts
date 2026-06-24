import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('bom_items')
@Index(['model', 'partNumber'], { unique: true })
export class BomItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'tenant_id' })
  tenant_id: string | null;

  @Column()
  @Index()
  model: string; // matches Plan.model

  @Column()
  partNumber: string; // NP / part number

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  location: string;

  @Column({ type: 'float' })
  usageFactor: number; // units consumed per assembled unit

  @Column({ default: 'EA' })
  unit: string; // EA | KG | M | L | etc.

  @Column({ type: 'text', nullable: true })
  imageUrl: string | null;

  @Column({ type: 'text', nullable: true })
  specUrl: string | null;

  @Column({ default: false })
  hasImage: boolean;
}
