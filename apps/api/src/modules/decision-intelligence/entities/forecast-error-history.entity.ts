import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ForecastRun } from './forecast-run.entity';

@Entity('forecast_error_history')
export class ForecastErrorHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ForecastRun, { nullable: true, onDelete: 'SET NULL' })
  run?: ForecastRun | null;

  @Column({ type: 'varchar', length: 80 })
  material: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  family?: string;

  @Column({ type: 'varchar', length: 40 })
  championMethod: string;

  @Column({ type: 'varchar', length: 32 })
  period: string;

  @Column({ type: 'float' })
  forecast: number;

  @Column({ type: 'float' })
  actual: number;

  @Column({ type: 'float' })
  residual: number;

  @Column({ type: 'float' })
  absoluteError: number;

  @Column({ type: 'float' })
  percentageError: number;

  @CreateDateColumn()
  createdAt: Date;
}
