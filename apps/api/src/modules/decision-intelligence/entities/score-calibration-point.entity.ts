import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('score_calibration_points')
export class ScoreCalibrationPoint {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'tenant_id' })
  tenant_id: string | null;

  @Column({ type: 'varchar', length: 24 })
  bucket: string;

  @Column({ type: 'float', default: 0 })
  avgRawScore: number;

  @Column({ type: 'float', default: 0 })
  avgCalibratedScore: number;

  @Column({ type: 'float', default: 0 })
  observedSuccessRate: number;

  @Column({ type: 'int', default: 0 })
  sampleSize: number;

  @CreateDateColumn()
  createdAt: Date;
}
