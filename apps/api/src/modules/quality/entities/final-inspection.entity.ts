import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';

export enum OqcResult {
  PASS = 'PASS',
  FAIL = 'FAIL',
  CONDITIONAL = 'CONDITIONAL'
}

@Entity('final_inspections')
export class FinalInspection {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'tenant_id' })
  tenant_id: string | null;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  workOrder: string;

  @Column({ type: 'varchar', length: 100 })
  partNumber: string;

  @Column({ type: 'float' })
  quantityInspected: number;

  @Column({ type: 'float', default: 0 })
  quantityPassed: number;

  @Column({ type: 'float', default: 0 })
  quantityFailed: number;

  @Index()
  @Column({ type: 'varchar', length: 24 })
  result: OqcResult;

  @Column({ type: 'varchar', length: 120, nullable: true })
  inspector: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  defectType?: string;

  @Column({ type: 'text', nullable: true })
  defectDescription?: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  severity?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'jsonb', nullable: true })
  evidence?: any;

  @Index()
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
