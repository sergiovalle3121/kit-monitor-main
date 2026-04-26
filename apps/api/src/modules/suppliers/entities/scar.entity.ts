import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { Supplier } from './supplier.entity';
import { IQCInspection } from '../../quality/entities/iqc-inspection.entity';

export enum ScarStatus {
  OPEN = 'open',
  SENT_TO_SUPPLIER = 'sent_to_supplier',
  AWAITING_RESPONSE = 'awaiting_response',
  RESPONSE_UNDER_REVIEW = 'response_under_review',
  ACTION_ACCEPTED = 'action_accepted',
  EFFECTIVENESS_REVIEW = 'effectiveness_review',
  CLOSED = 'closed'
}

export enum ScarSeverity {
  MINOR = 'minor',
  MAJOR = 'major',
  CRITICAL = 'critical'
}

@Entity('scars')
export class SCAR {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 32, unique: true })
  @Index()
  scarNumber: string; // e.g. SCAR-2024-0001

  @Column({ type: 'varchar', length: 32, default: 'open' })
  status: ScarStatus;

  @Column({ type: 'varchar', length: 16, default: 'major' })
  severity: ScarSeverity;

  // Links
  @ManyToOne(() => Supplier)
  supplier: Supplier;

  @ManyToOne(() => IQCInspection, { nullable: true })
  iqcInspection?: IQCInspection;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  partNumber: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  lotNumber?: string;

  // Issue Details
  @Column({ type: 'text' })
  issueSummary: string;

  @Column({ type: 'text' })
  defectDescription: string;

  @Column({ type: 'float' })
  quantityAffected: number;

  @Column({ type: 'text', nullable: true })
  containmentRequired?: string;

  // Supplier Feedback
  @Column({ type: 'text', nullable: true })
  supplierRootCause?: string;

  @Column({ type: 'text', nullable: true })
  supplierCorrectiveAction?: string;

  @Column({ type: 'text', nullable: true })
  supplierResponse?: string;

  // Internal Review
  @Column({ type: 'text', nullable: true })
  internalReviewNotes?: string;

  @Column({ type: 'text', nullable: true })
  effectivenessConfirmation?: string;

  // Governance
  @Column({ type: 'varchar', length: 120 })
  createdBy: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  internalOwner?: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  supplierContact?: string;

  @Column({ type: 'timestamp', nullable: true })
  dueDate?: Date;

  @Column({ type: 'timestamp', nullable: true })
  closedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
