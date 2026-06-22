import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';
import type { PotentialRating } from '../hr-analytics';
import type { ReviewStatus } from '../hr-lifecycle';

export type SuccessionReadiness = 'READY_NOW' | 'ONE_TWO_YEARS' | 'NOT_READY';

/**
 * A performance & potential review — the input to the 9-box talent grid and
 * succession planning. `performanceScore` (1..5) × `potential` (LOW/MED/HIGH)
 * place the person in a 9-box cell (derived in analytics, cached in `nineBoxKey`
 * for fast filtering). Folio EVAL- from the central numbering.
 */
@Entity('hr_performance_reviews')
@Index('idx_hr_review_scope_period', ['tenant_id', 'plant_id', 'period'])
export class HrPerformanceReview extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 32, nullable: true })
  folio: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true, name: 'employee_id' })
  employeeId: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true, name: 'employee_number' })
  employeeNumber: string | null;

  @Column({ type: 'varchar', length: 160, name: 'employee_name' })
  employeeName: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  area: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  department: string | null;

  @Column({ type: 'varchar', length: 16 })
  period: string;

  @Column({ type: 'varchar', length: 160, nullable: true })
  reviewer: string | null;

  /** 1..5 performance score. */
  @Column({ type: 'float', nullable: true, name: 'performance_score' })
  performanceScore: number | null;

  @Column({ type: 'varchar', length: 8, nullable: true })
  potential: PotentialRating | null;

  @Column({ type: 'varchar', length: 24, nullable: true, name: 'nine_box_key' })
  nineBoxKey: string | null;

  @Column({ type: 'varchar', length: 16, default: 'DRAFT' })
  status: ReviewStatus;

  @Column({ type: 'float', nullable: true, name: 'goals_met_pct' })
  goalsMetPct: number | null;

  @Column({ type: 'varchar', length: 16, nullable: true, name: 'succession_readiness' })
  successionReadiness: SuccessionReadiness | null;

  @Column({ type: 'text', nullable: true })
  comments: string | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'review_date' })
  reviewDate: Date | null;
}
