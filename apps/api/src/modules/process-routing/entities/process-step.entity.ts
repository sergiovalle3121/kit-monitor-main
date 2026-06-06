import {
  Entity, PrimaryGeneratedColumn, Column, Index, OneToMany,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { ProcessStepMaterial } from './process-step-material.entity';

/**
 * A single ordered step (station) in a model's manufacturing route.
 * Engineering authors the route: which stations, in what order, with which
 * visual aid and which materials are consumed at each one.
 */
@Entity('process_steps')
@Index(['model', 'revision', 'sequence'])
export class ProcessStep {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  model: string;

  @Column({ default: '1.0' })
  revision: string;

  @Column({ type: 'int', default: 1 })
  sequence: number;

  @Column()
  name: string; // e.g. "SMT", "AOI", "Ensamble final", "Prueba ICT", "Empaque"

  @Column({ type: 'varchar', length: 60, nullable: true })
  stationType: string | null; // smt | assembly | test | inspection | packing

  @Column({ type: 'varchar', length: 64, nullable: true })
  visualAidId: string | null; // links to visual_aids.id

  @Column({ type: 'text', nullable: true })
  instructions: string | null;

  @OneToMany(() => ProcessStepMaterial, (m) => m.step)
  materials: ProcessStepMaterial[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
