import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ForecastRun } from './forecast-run.entity';

@Entity('plan_scenarios')
export class PlanScenario {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ForecastRun, { onDelete: 'SET NULL', nullable: true })
  run?: ForecastRun | null;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'simple-json' })
  assumptions: Record<string, any>;

  @Column({ type: 'simple-json' })
  constraints: Record<string, any>;

  @Column({ type: 'simple-json' })
  logisticRisk: Record<string, any>;

  @Column({ type: 'float', default: 0 })
  viabilityScore: number;

  @Column({ type: 'float', default: 0 })
  estimatedProbability: number;

  @Column({ type: 'simple-json', nullable: true })
  highlights?: Record<string, any>;

  @Column({ type: 'varchar', length: 24, default: 'candidate' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;
}
