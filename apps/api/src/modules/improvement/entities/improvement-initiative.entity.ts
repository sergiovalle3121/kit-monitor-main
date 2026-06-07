import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';
import type { InitiativeStatus } from '../initiative-state';

export type InitiativeMethodology =
  | 'KAIZEN'
  | 'LEAN'
  | 'SIX_SIGMA'
  | 'FIVE_S'
  | 'OTHER';

export type InitiativePriority = 'LOW' | 'MEDIUM' | 'HIGH';

/**
 * A continuous-improvement initiative (Kaizen / Lean / Six Sigma / 5S).
 * Tracks the OpEx loop from idea to verified savings. Folio comes from the
 * central DocumentNumberingService (docType IMPROVEMENT). Fully additive table.
 */
@Entity('improvement_initiatives')
@Index('idx_improvement_scope_status', ['tenant_id', 'plant_id', 'status'])
export class ImprovementInitiative extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 32, nullable: true })
  folio: string | null;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 16, default: 'KAIZEN' })
  methodology: InitiativeMethodology;

  @Column({ type: 'varchar', length: 16, default: 'DRAFT' })
  status: InitiativeStatus;

  @Column({ type: 'varchar', length: 8, default: 'MEDIUM' })
  priority: InitiativePriority;

  @Column({ type: 'varchar', length: 120, nullable: true })
  area: string | null;

  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true, name: 'program_id' })
  programId: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'owner_email' })
  ownerEmail: string | null;

  /** Annualized estimated savings (float for SQLite/PG portability). */
  @Column({ type: 'float', default: 0, name: 'estimated_savings' })
  estimatedSavings: number;

  /** Verified realized savings. */
  @Column({ type: 'float', default: 0, name: 'actual_savings' })
  actualSavings: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'started_at' })
  startedAt: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'implemented_at' })
  implementedAt: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'verified_at' })
  verifiedAt: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'closed_at' })
  closedAt: Date | null;
}
