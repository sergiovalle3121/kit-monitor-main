import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum ExceptionSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum ExceptionDomain {
  PLANNING = 'PLANNING',
  QUALITY = 'QUALITY',
  INVENTORY = 'INVENTORY',
  WAREHOUSE = 'WAREHOUSE',
  PRODUCTION = 'PRODUCTION',
  SHIPPING = 'SHIPPING',
  GOVERNANCE = 'GOVERNANCE'
}

export enum ExceptionStatus {
  OPEN = 'OPEN',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  RESOLVED = 'RESOLVED'
}

@Entity('operational_exceptions')
export class OperationalException {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: ExceptionSeverity,
    default: ExceptionSeverity.MEDIUM
  })
  @Index()
  severity: ExceptionSeverity;

  @Column({
    type: 'enum',
    enum: ExceptionDomain
  })
  @Index()
  domain: ExceptionDomain;

  @Column({
    type: 'enum',
    enum: ExceptionStatus,
    default: ExceptionStatus.OPEN
  })
  @Index()
  status: ExceptionStatus;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ nullable: true })
  @Index()
  actor?: string;

  @Column({ nullable: true })
  assignee?: string;

  @Column({ nullable: true })
  acknowledgedBy?: string;

  @Column({ type: 'timestamp', nullable: true })
  acknowledgedAt?: Date;

  @Column({ nullable: true })
  resolvedBy?: string;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt?: Date;

  @Column({ type: 'text', nullable: true })
  resolutionReason?: string;

  @Column({ type: 'text', nullable: true })
  resolutionComments?: string;

  @Column({ type: 'timestamp', nullable: true })
  dueAt?: Date;

  @Column({ type: 'jsonb', nullable: true, default: [] })
  managementTimeline?: Array<{
    action: string;
    actor: string;
    timestamp: Date;
    note?: string;
  }>;

  @Column({ default: 0 })
  recurrenceCount: number;

  @Column({ nullable: true })
  @Index()
  buildingId?: string;

  @Column({ nullable: true })
  @Index()
  programId?: string;

  @Column({ nullable: true })
  @Index()
  lineId?: string;

  @Column({ nullable: true })
  resourceType?: string;

  @Column({ nullable: true })
  resourceId?: string;

  @Column({ nullable: true })
  auditLogId?: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
