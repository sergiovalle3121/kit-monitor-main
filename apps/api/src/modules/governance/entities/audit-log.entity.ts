import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  actor: string; // email or username

  @Column()
  @Index()
  action: string; // e.g., 'RELEASE_WO', 'APPROVE_QUALITY'

  @Column()
  @Index()
  entity: string; // e.g., 'Plan', 'Ncr'

  @Column({ nullable: true })
  entityId: string;

  @Column({ type: 'jsonb', nullable: true })
  before?: any;

  @Column({ type: 'jsonb', nullable: true })
  after?: any;

  @Column({ default: 'ALLOWED' })
  result: string; // ALLOWED, DENIED

  @Column({ type: 'text', nullable: true })
  reason?: string;

  @Column({ type: 'jsonb', nullable: true })
  scope?: any; // The organizational scope active during the action

  @CreateDateColumn()
  timestamp: Date;
}
