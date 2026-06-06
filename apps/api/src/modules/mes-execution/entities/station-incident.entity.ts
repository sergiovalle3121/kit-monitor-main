import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'open' | 'contained' | 'dispositioned';
export type IncidentDisposition = 'rework' | 'scrap' | 'use_as_is';

/**
 * A quality incident raised from a station. The affected quantity is segregated
 * (held out of the good flow) so the line keeps running on conforming units;
 * quality dispositions it later (rework / scrap / use-as-is). When `blocksFlow`
 * is set the whole station is blocked until disposition.
 */
@Entity('mes_station_incidents')
export class StationIncident {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  @Index()
  executionId: number;

  @Column({ type: 'int' })
  @Index()
  executionStepId: number;

  @Column({ type: 'varchar', length: 160, nullable: true })
  stepName: string | null;

  @Column({ type: 'varchar', length: 80 })
  type: string;

  @Column({ type: 'varchar', length: 16, default: 'medium' })
  severity: IncidentSeverity;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** Units segregated by this incident. */
  @Column({ type: 'float', default: 0 })
  qtyAffected: number;

  @Column({ type: 'varchar', length: 120, nullable: true })
  serial: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  photoVisualAidId: string | null;

  @Column({ type: 'boolean', default: false })
  blocksFlow: boolean;

  @Column({ type: 'varchar', length: 24, default: 'open' })
  @Index()
  status: IncidentStatus;

  @Column({ type: 'varchar', length: 16, nullable: true })
  disposition: IncidentDisposition | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  raisedBy: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  resolvedBy: string | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  resolvedAt: Date | null;

  /** Optional escalation link to a formal NCR. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  ncrId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
