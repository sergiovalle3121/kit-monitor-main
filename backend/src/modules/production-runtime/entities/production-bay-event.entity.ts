import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Kit } from '../../kits/entities/kit.entity';

@Entity('production_bay_events')
@Index(['clientRequestId'], { unique: true })
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

  @Column({ type: 'varchar', length: 80, nullable: true })
  clientRequestId?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  revertedAt?: Date | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  revertedReason?: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
