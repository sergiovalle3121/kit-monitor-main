import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, OneToOne, JoinColumn } from 'typeorm';
import { Kit } from '../../kits/entities/kit.entity';

@Entity('production_wip')
export class ProductionWip {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Kit)
  @JoinColumn()
  kit: Kit;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  workOrder: string;

  @Column({ type: 'varchar', length: 100 })
  partNumber: string; // The parent part being produced

  @Column({ type: 'float' })
  targetQty: number;

  @Column({ type: 'float', default: 0 })
  completedQty: number;

  @Column({ type: 'float', default: 0 })
  scrapQty: number;

  @Column({ type: 'varchar', length: 32, default: 'in_production' })
  status: 'in_production' | 'completed' | 'on_hold' | 'ready_for_fg';

  @Column({ type: 'varchar', length: 64, nullable: true })
  line: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  building: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  program: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;
}
