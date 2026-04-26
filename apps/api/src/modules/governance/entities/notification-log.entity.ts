import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { OperationalException } from './operational-exception.entity';

@Entity('notification_logs')
export class NotificationLog {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => OperationalException)
  exception: OperationalException;

  @Column()
  exceptionId: number;

  @Column()
  type: string; // CREATED, OVERDUE, ESCALATED

  @Column()
  recipient: string;

  @Column()
  channel: string; // EMAIL, IN_APP

  @Column({ default: 'SENT' })
  status: string; // SENT, FAILED, SIMULATED

  @Column({ type: 'text', nullable: true })
  error?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: any;

  @CreateDateColumn()
  timestamp: Date;
}
