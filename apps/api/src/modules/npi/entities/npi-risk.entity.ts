import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';
import type { NpiRiskSeverity, NpiRiskStatus } from '../npi-risk-state';

/**
 * NpiRisk — an additive, advisory risk on a launch (owner / severity / due date /
 * status). Powers the dossier's "Open Risks" panel and feeds the "what's missing"
 * view. Fully ADDITIVE prefixed table (`npi_`); links to its project by id
 * (varchar, no FK constraint) so it stays decoupled. Never blocks a gate.
 */
@Entity('npi_risk')
@Index('idx_npi_risk_scope_project', ['tenant_id', 'plant_id', 'projectId'])
@Index('idx_npi_risk_project_status', ['projectId', 'status'])
export class NpiRisk extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The owning NpiProject (denormalized id; no FK constraint). */
  @Index()
  @Column({ type: 'varchar', length: 36, name: 'project_id' })
  projectId: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 16, default: 'MEDIUM' })
  severity: NpiRiskSeverity;

  @Column({ type: 'varchar', length: 16, default: 'OPEN' })
  status: NpiRiskStatus;

  /** Who owns closing the risk (free-text name, email or role). */
  @Column({ type: 'varchar', length: 200, nullable: true })
  owner: string | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'due_date' })
  dueDate: Date | null;

  /** Mitigation plan / notes. */
  @Column({ type: 'varchar', length: 1000, nullable: true })
  mitigation: string | null;
}
