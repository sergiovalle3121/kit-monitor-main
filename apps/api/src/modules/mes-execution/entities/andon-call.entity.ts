import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';

export type AndonType = 'material' | 'quality' | 'maintenance' | 'stop';
export type AndonStatus = 'open' | 'ack' | 'resolved';

/** Andon call raised from a station: summon materials / quality / maintenance / line stop. */
@Entity('mes_andon_calls')
export class AndonCall {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'tenant_id' })
  tenant_id: string | null;

  @Column({ type: 'int' })
  @Index()
  executionId: number;

  @Column({ type: 'int', nullable: true })
  executionStepId: number | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  stepName: string | null;

  @Column({ type: 'varchar', length: 16 })
  type: AndonType;

  @Column({ type: 'varchar', length: 16, default: 'open' })
  @Index()
  status: AndonStatus;

  @Column({ type: 'varchar', length: 280, nullable: true })
  note: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  raisedBy: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  acknowledgedBy: string | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  acknowledgedAt: Date | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  resolvedBy: string | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  resolvedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
