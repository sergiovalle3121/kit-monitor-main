import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Kit } from '../../kits/entities/kit.entity';

@Entity('production_bay_events')
export class ProductionBayEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Kit, { onDelete: 'CASCADE' })
  kit: Kit;

  @Column({ type: 'int' })
  bayId: number;

  @Column({ type: 'varchar', length: 80 })
  model: string;

  @Column({ type: 'float' })
  quantity: number;

  @Column({ type: 'varchar', length: 80, nullable: true })
  operator?: string;

  @Column({ type: 'varchar', length: 240, nullable: true })
  notes?: string;

  @Column({ type: 'varchar', length: 32, default: 'bay_enter' })
  source: string;

  @Column({ type: 'timestamp' })
  timestamp: Date;

  @CreateDateColumn()
  createdAt: Date;
}
