import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Plan } from '../../plans/entities/plan.entity';
import { Kit } from '../../kits/entities/kit.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';

export type CancellationRequestStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'expired';

@Entity('cancellation_requests')
export class CancellationRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Plan, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'publication_id' })
  publication: Plan;

  @ManyToOne(() => Kit, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'kit_id' })
  kit: Kit;

  @Column({ name: 'requested_by' })
  requestedBy: string;

  @Column({ default: 'pending' })
  status: CancellationRequestStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'responded_at', type: DATE_COLUMN_TYPE, nullable: true })
  respondedAt: Date | null;

  @Column({ name: 'expires_at', type: DATE_COLUMN_TYPE })
  expiresAt: Date;
}
