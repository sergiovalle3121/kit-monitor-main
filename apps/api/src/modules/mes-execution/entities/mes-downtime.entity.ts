import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';

export type DowntimeReason =
  | 'material_shortage'
  | 'quality_block'
  | 'andon_stop'
  | 'changeover'
  | 'other';

/**
 * Measured line downtime ("tiempo caído") for OEE availability. Opened when a
 * station stalls (material shortage, quality block, line-stop andon) and closed
 * when the cause is resolved (material delivered, incident dispositioned, andon
 * cleared). Open-ended downtimes are deduplicated per (step, reason).
 */
@Entity('mes_downtime_events')
export class MesDowntime {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  @Index()
  executionId: number;

  @Column({ type: 'int', nullable: true })
  executionStepId: number | null;

  @Column({ type: 'varchar', length: 24 })
  @Index()
  reason: DowntimeReason;

  @Column({ type: 'varchar', length: 120, nullable: true })
  partNumber: string | null;

  @Column({ type: DATE_COLUMN_TYPE })
  startedAt: Date;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  endedAt: Date | null;

  @Column({ type: 'int', nullable: true })
  durationSec: number | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  triggeredBy: string | null;

  @Column({ type: 'int', nullable: true })
  materialRequestId: number | null;

  @Column({ type: 'int', nullable: true })
  andonId: number | null;

  @Column({ type: 'int', nullable: true })
  incidentId: number | null;

  @Column({ type: 'varchar', length: 280, nullable: true })
  notes: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
