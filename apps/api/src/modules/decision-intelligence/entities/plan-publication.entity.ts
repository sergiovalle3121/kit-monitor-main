import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ForecastRun } from './forecast-run.entity';
import { PlanScenario } from './plan-scenario.entity';

@Entity('plan_publications')
export class PlanPublication {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ForecastRun, { nullable: true, onDelete: 'SET NULL' })
  run?: ForecastRun | null;

  @ManyToOne(() => PlanScenario, { nullable: true, onDelete: 'SET NULL' })
  scenario?: PlanScenario | null;

  @Column({ type: 'varchar', length: 120 })
  title: string;

  @Column({ type: 'float', default: 0 })
  planConfidenceScore: number;

  @Column({ type: 'simple-json', nullable: true })
  risks?: Record<string, any>;

  @Column({ type: 'varchar', length: 80, nullable: true })
  publishedBy?: string;

  @CreateDateColumn()
  createdAt: Date;
}
