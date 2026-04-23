import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, Index, OneToOne, JoinColumn } from 'typeorm';
import { QualityHold } from '../../quality/entities/quality-hold.entity';
import { QuarantineTransfer } from '../../quality/entities/quarantine-transfer.entity';

export type NcrStatus = 'open' | 'under_review' | 'contained' | 'dispositioned' | 'closed';
export type NcrSeverity = 'minor' | 'major' | 'critical';
export type NcrSourceType = 'incoming' | 'in-process' | 'outgoing' | 'warehouse' | 'supplier' | 'customer';

@Entity('ncrs')
export class NCR {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 32, unique: true })
  @Index()
  ncrNumber: string; // e.g. NCR-2024-001

  @Column({ type: 'varchar', length: 32, default: 'open' })
  status: NcrStatus;

  @Column({ type: 'varchar', length: 16, default: 'major' })
  severity: NcrSeverity;

  // Operational Context
  @Column({ type: 'varchar', length: 64, nullable: true })
  building?: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  warehouse?: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  line?: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  customer?: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  program?: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  model?: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  workOrder?: string;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  partNumber: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  lotNumber?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  serialNumber?: string;

  // Defect Info
  @Column({ type: 'varchar', length: 64 })
  category: string; // e.g. Mechanical, Cosmetic, Component

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 32 })
  sourceType: NcrSourceType;

  @Column({ type: 'float' })
  quantityAffected: number;

  // Links
  @ManyToOne(() => QualityHold, { nullable: true })
  hold?: QualityHold;

  @ManyToOne(() => QuarantineTransfer, { nullable: true })
  quarantineTransfer?: QuarantineTransfer;

  // Governance
  @Column({ type: 'varchar', length: 120 })
  createdBy: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  owner?: string;

  @Column({ type: 'text', nullable: true })
  dispositionNotes?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
