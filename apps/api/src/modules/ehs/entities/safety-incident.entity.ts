import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';
import type { IncidentStatus } from '../incident-state';

export type IncidentType =
  | 'NEAR_MISS'
  | 'FIRST_AID'
  | 'RECORDABLE'
  | 'LOST_TIME'
  | 'ENVIRONMENTAL'
  | 'PROPERTY_DAMAGE';

export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * An EHS safety / environmental incident (or near-miss). Folio from the central
 * numbering service (docType EHS_INCIDENT → INC-…). Fully additive table.
 * `lostDays` and the RECORDABLE/LOST_TIME types back the safety KPIs.
 */
@Entity('safety_incidents')
@Index('idx_incident_scope_status', ['tenant_id', 'plant_id', 'status'])
export class SafetyIncident extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 32, nullable: true })
  folio: string | null;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 20, default: 'NEAR_MISS' })
  type: IncidentType;

  @Column({ type: 'varchar', length: 12, default: 'LOW' })
  severity: IncidentSeverity;

  @Column({ type: 'varchar', length: 16, default: 'REPORTED' })
  status: IncidentStatus;

  @Column({ type: 'varchar', length: 120, nullable: true })
  area: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  location: string | null;

  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true, name: 'program_id' })
  programId: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'reported_by' })
  reportedBy: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true, name: 'injured_person' })
  injuredPerson: string | null;

  @Column({ type: 'int', default: 0, name: 'lost_days' })
  lostDays: number;

  @Column({ type: 'text', nullable: true, name: 'root_cause' })
  rootCause: string | null;

  @Column({ type: 'text', nullable: true, name: 'corrective_action' })
  correctiveAction: string | null;

  /** CAPA responsible (responsable de la acción correctiva). Additive, nullable. */
  @Column({ type: 'varchar', length: 200, nullable: true, name: 'capa_owner' })
  capaOwner: string | null;

  /** CAPA commitment date (fecha de compromiso). Drives the due/overdue alert. */
  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'capa_due_date' })
  capaDueDate: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'occurred_at' })
  occurredAt: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'investigated_at' })
  investigatedAt: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'closed_at' })
  closedAt: Date | null;
}
