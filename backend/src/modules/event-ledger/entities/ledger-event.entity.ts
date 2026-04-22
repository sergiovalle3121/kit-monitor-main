import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum EventDomain {
  MATERIALS = 'MATERIALS',
  PLANNING = 'PLANNING',
  PRODUCTION = 'PRODUCTION',
  ENGINEERING = 'ENGINEERING',
  QUALITY = 'QUALITY',
  SHIPPING = 'SHIPPING',
  SYSTEM = 'SYSTEM',
}

@Entity('ledger_events')
export class LedgerEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  timestamp: Date;

  @Column({ nullable: true })
  actorId: string;

  @Column({ nullable: true })
  actorName: string;

  @Column()
  domain: EventDomain;

  @Column()
  action: string; // e.g., 'KIT_CREATED', 'STATUS_CHANGED', 'SHORTAGE_DETECTED'

  @Column({ nullable: true })
  referenceType: string; // e.g., 'KIT', 'WORK_ORDER', 'MATERIAL'

  @Column({ nullable: true })
  referenceId: string;

  // Organizational & Industrial Context
  @Column({ type: 'jsonb', nullable: true, default: {} })
  context: {
    plant?: string;
    warehouse?: string;
    line?: string;
    shift?: string;
    customer?: string;
    program?: string;
    model?: string;
    workOrder?: string;
    revision?: string;
    lot?: string;
    serial?: string;
  };

  // Transactional Specifics
  @Column({ type: 'jsonb', nullable: true, default: {} })
  transaction: {
    quantity?: number;
    fromLocation?: string;
    toLocation?: string;
    unit?: string;
  };

  // State changes, reasons, and approvals
  @Column({ type: 'jsonb', nullable: true, default: {} })
  metadata: {
    reasonCode?: string;
    reasonDesc?: string;
    approvalContext?: any;
    beforeState?: any;
    afterState?: any;
    [key: string]: any;
  };
}
