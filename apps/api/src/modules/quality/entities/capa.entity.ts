import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { NCR } from '../../ncr/entities/ncr.entity';
import { Disposition } from './disposition.entity';

export enum CapaStatus {
  OPEN = 'open',
  INVESTIGATION = 'investigation',
  ACTION_DEFINED = 'action_defined',
  IN_PROGRESS = 'in_progress',
  EFFECTIVENESS_REVIEW = 'effectiveness_review',
  CLOSED = 'closed'
}

export enum CapaPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

@Entity('capas')
export class CAPA {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'tenant_id' })
  tenant_id: string | null;

  @Column({ type: 'varchar', length: 32, unique: true })
  @Index()
  capaNumber: string; // e.g. CAPA-2024-0001

  @Column({ type: 'varchar', length: 32, default: 'open' })
  status: CapaStatus;

  @Column({ type: 'varchar', length: 16, default: 'medium' })
  priority: CapaPriority;

  // Contextual Links
  @ManyToOne(() => NCR, { nullable: true })
  ncr?: NCR;

  @ManyToOne(() => Disposition, { nullable: true })
  disposition?: Disposition;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  partNumber: string;

  // Industrial Context
  @Column({ type: 'varchar', length: 64, nullable: true })
  building?: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  line?: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  program?: string;

  // Analysis & Actions
  @Column({ type: 'text' })
  problemStatement: string;

  @Column({ type: 'text', nullable: true })
  rootCause?: string;

  @Column({ type: 'text', nullable: true })
  correctiveAction?: string;

  @Column({ type: 'text', nullable: true })
  preventiveAction?: string;

  @Column({ type: 'text', nullable: true })
  effectivenessCheck?: string;

  // Governance
  @Column({ type: 'varchar', length: 120 })
  createdBy: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  owner?: string;

  @Column({ type: 'timestamp', nullable: true })
  dueDate?: Date;

  @Column({ type: 'timestamp', nullable: true })
  closedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
