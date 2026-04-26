import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Supplier } from '../../suppliers/entities/supplier.entity';

export enum IqcResult {
  PASS = 'pass',
  FAIL = 'fail',
  CONDITIONAL = 'conditional',
  PENDING = 'pending',
}

@Entity('iqc_inspections')
export class IQCInspection {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 32, unique: true })
  @Index()
  inspectionNumber: string; // IQC-2024-0001

  @ManyToOne(() => Supplier, { nullable: true })
  supplier?: Supplier;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  partNumber: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  lotNumber?: string;

  @Column({ type: 'varchar', length: 32, default: 'pending' })
  result: IqcResult;

  @Column({ type: 'float', nullable: true })
  sampleSize?: number;

  @Column({ type: 'float', nullable: true })
  defectsFound?: number;

  @Column({ type: 'varchar', length: 120 })
  inspector: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'simple-json', nullable: true })
  evidenceLinks?: string[]; // Links to CoC, photos, etc.

  @Column({ type: 'varchar', length: 64, nullable: true })
  warehouseId?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
