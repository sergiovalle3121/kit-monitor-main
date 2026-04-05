import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { PlanPublication } from './plan-publication.entity';

@Entity('plan_actual_outcomes')
export class PlanActualOutcome {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => PlanPublication, { onDelete: 'CASCADE' })
  publication: PlanPublication;

  @Column({ type: 'float', default: 0 })
  planQty: number;

  @Column({ type: 'float', default: 0 })
  actualQty: number;

  @Column({ type: 'float', default: 0 })
  varianceQty: number;

  @Column({ type: 'float', default: 0 })
  variancePct: number;

  @Column({ type: 'varchar', length: 32 })
  fulfillmentResult: string;

  @Column({ type: 'int', default: 0 })
  shortageEvents: number;

  @Column({ type: 'float', default: 0 })
  overtimeHours: number;

  @Column({ type: 'simple-json', nullable: true })
  details?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
