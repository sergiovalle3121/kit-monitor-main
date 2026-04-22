import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ForecastRun } from './forecast-run.entity';

@Entity('forecast_series_results')
export class ForecastSeriesResult {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ForecastRun, (run) => run.series, { onDelete: 'CASCADE' })
  run: ForecastRun;

  @Column({ type: 'varchar', length: 80 })
  material: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  location?: string;

  @Column({ type: 'varchar', length: 40 })
  championMethod: string;

  @Column({ type: 'float', default: 0 })
  mape: number;

  @Column({ type: 'float', default: 0 })
  mad: number;

  @Column({ type: 'float', default: 0 })
  bias: number;

  @Column({ type: 'float', default: 0 })
  forecastNext: number;

  @Column({ type: 'simple-json', nullable: true })
  forecastHorizon?: number[];

  @Column({ type: 'simple-json', nullable: true })
  diagnostics?: Record<string, any>;

  @Column({ type: 'float', default: 0 })
  confidenceScore: number;
}
