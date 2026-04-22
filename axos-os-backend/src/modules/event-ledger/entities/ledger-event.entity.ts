import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';
import { JSON_COLUMN_TYPE } from '../../../common/database/json-column-type';

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

  @CreateDateColumn({ type: DATE_COLUMN_TYPE })
  timestamp: Date;

  @Column({ nullable: true })
  actorId: string;

  @Column({ nullable: true })
  actorName: string;

  @Column()
  domain: EventDomain;

  @Column()
  action: string; // e.g., 'KIT_CREATED', 'STATUS_CHANGED', 'SHORTAGE_DETECTED'

  @Index()
  @Column({ nullable: true })
  referenceType: string; // e.g., 'KIT', 'WORK_ORDER', 'MATERIAL'

  @Index()
  @Column({ nullable: true })
  referenceId: string;

  // Organizational & Industrial Context (Explicit indexed columns for dashboards)
  @Index()
  @Column({ nullable: true })
  plant: string;

  @Index()
  @Column({ nullable: true })
  warehouse: string;

  @Index()
  @Column({ nullable: true })
  line: string;

  @Index()
  @Column({ nullable: true })
  shift: string;

  @Index()
  @Column({ nullable: true })
  customer: string;

  @Index()
  @Column({ nullable: true })
  program: string;

  @Index()
  @Column({ nullable: true })
  model: string;

  @Index()
  @Column({ nullable: true })
  workOrder: string;

  // Additional context not queried heavily
  @Column({ type: JSON_COLUMN_TYPE, nullable: true })
  context: {
    revision?: string;
    lot?: string;
    serial?: string;
    [key: string]: any;
  };

  // Transactional Specifics
  @Column({ type: JSON_COLUMN_TYPE, nullable: true })
  transaction: {
    quantity?: number;
    fromLocation?: string;
    toLocation?: string;
    unit?: string;
  };

  // State changes, reasons, and approvals
  @Column({ type: JSON_COLUMN_TYPE, nullable: true })
  metadata: {
    reasonCode?: string;
    reasonDesc?: string;
    approvalContext?: any;
    beforeState?: any;
    afterState?: any;
    [key: string]: any;
  };
}
