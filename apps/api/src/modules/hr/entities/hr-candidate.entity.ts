import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';
import type { CandidateStage } from '../hr-lifecycle';

export type CandidateSource =
  | 'REFERRAL'
  | 'JOB_BOARD'
  | 'WALK_IN'
  | 'AGENCY'
  | 'INTERNAL'
  | 'SOCIAL'
  | 'OTHER';

/**
 * An applicant moving through the pipeline of a requisition. Denormalized link
 * to the requisition (UUID + folio) to stay additive. `stage` drives the funnel
 * and time-to-fill analytics; `HIRED` can spawn an employee record.
 */
@Entity('hr_candidates')
@Index('idx_hr_cand_scope_stage', ['tenant_id', 'plant_id', 'stage'])
export class HrCandidate extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid', nullable: true, name: 'requisition_id' })
  requisitionId: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true, name: 'requisition_folio' })
  requisitionFolio: string | null;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  source: CandidateSource | null;

  @Column({ type: 'varchar', length: 16, default: 'APPLIED' })
  stage: CandidateStage;

  @Column({ type: 'int', nullable: true })
  rating: number | null;

  @Index()
  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'applied_date' })
  appliedDate: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'stage_updated_date' })
  stageUpdatedDate: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'hired_date' })
  hiredDate: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
