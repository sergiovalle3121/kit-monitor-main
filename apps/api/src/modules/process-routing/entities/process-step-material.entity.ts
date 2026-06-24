import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { ProcessStep } from './process-step.entity';

/**
 * A material consumed at a process step, with the quantity per finished unit.
 * Drives backflush: confirming N units at this step decrements
 * qtyPerUnit × N of this part.
 */
@Entity('process_step_materials')
export class ProcessStepMaterial {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'tenant_id' })
  tenant_id: string | null;

  @ManyToOne(() => ProcessStep, (s) => s.materials, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'step_id' })
  step: ProcessStep;

  @Column({ name: 'step_id' })
  @Index()
  stepId: number;

  @Column()
  partNumber: string;

  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  @Column({ type: 'float', default: 1 })
  qtyPerUnit: number;

  @Column({ default: 'EA' })
  unit: string;
}
