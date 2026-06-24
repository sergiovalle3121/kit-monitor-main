import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { NCR } from '../../ncr/entities/ncr.entity';
import { QualityHold } from './quality-hold.entity';

export enum DispositionType {
  RELEASE = 'release',
  SCRAP = 'scrap',
  RTV = 'rtv',
  REWORK = 'rework',
  USE_AS_IS = 'use_as_is'
}

export enum DispositionStatus {
  PROPOSED = 'proposed',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  EXECUTED = 'executed',
  CLOSED = 'closed'
}

@Entity('dispositions')
export class Disposition {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'tenant_id' })
  tenant_id: string | null;

  @Column({ type: 'varchar', length: 32 })
  type: DispositionType;

  @Column({ type: 'varchar', length: 32, default: 'proposed' })
  status: DispositionStatus;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'float' })
  quantity: number;

  // Contextual Links
  @ManyToOne(() => NCR, { nullable: true })
  ncr?: NCR;

  @ManyToOne(() => QualityHold, { nullable: true })
  hold?: QualityHold;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  partNumber: string;

  @Column({ type: 'varchar', length: 64 })
  warehouseId: string;

  @Column({ type: 'varchar', length: 100 })
  location: string;

  // Governance
  @Column({ type: 'varchar', length: 120 })
  proposedBy: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  approvedBy?: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  executedBy?: string;

  @Column({ type: 'timestamp', nullable: true })
  executedAt?: Date;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
