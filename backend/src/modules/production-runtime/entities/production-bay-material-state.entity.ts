import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Kit } from '../../kits/entities/kit.entity';

@Entity('production_bay_material_states')
@Index(['kit', 'bayId', 'partNumber'], { unique: true })
export class ProductionBayMaterialState {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Kit, { onDelete: 'CASCADE' })
  kit: Kit;

  @Column({ type: 'int' })
  bayId: number;

  @Column({ type: 'varchar', length: 80 })
  model: string;

  @Column({ type: 'varchar', length: 80 })
  partNumber: string;

  @Column({ type: 'varchar', length: 240, nullable: true })
  description?: string;

  @Column({ type: 'float', default: 0 })
  usagePerAssembly: number;

  @Column({ type: 'float', default: 0 })
  availableQty: number;

  @Column({ type: 'float', default: 0 })
  consumedQty: number;

  @Column({ type: 'float', default: 0 })
  lowStockThreshold: number;

  @UpdateDateColumn()
  updatedAt: Date;
}
