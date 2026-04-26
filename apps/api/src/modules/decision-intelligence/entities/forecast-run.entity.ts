import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { ForecastSeriesResult } from './forecast-series-result.entity';

@Entity('forecast_runs')
export class ForecastRun {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  sourceFile?: string;

  @Column({ type: 'varchar', length: 24, default: 'draft' })
  status: string;

  @Column({ type: 'simple-json', nullable: true })
  assumptions?: Record<string, any>;

  @Column({ type: 'float', default: 0 })
  confidenceScore: number;

  @OneToMany(() => ForecastSeriesResult, (series) => series.run, { cascade: true })
  series: ForecastSeriesResult[];

  @CreateDateColumn()
  createdAt: Date;
}
