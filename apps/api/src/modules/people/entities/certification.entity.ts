import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';

/**
 * A skill / training certification for an employee (RH / Capital Humano).
 * Self-contained and additive: the employee is denormalized (name + email) to
 * avoid coupling with the users module. The live status (VALID / EXPIRING /
 * EXPIRED) is derived from `expiresDate` at read time — not stored.
 *
 * `employeeId` (additive, nullable) optionally links the cert to a real
 * `hr_employees` row so the competency matrix can be keyed by a stable id. Old
 * certs without it keep working: they are matched/grouped by `employeeName`.
 * The certification date is the existing `issuedDate` (no separate column).
 */
@Entity('certifications')
@Index('idx_cert_scope_skill', ['tenant_id', 'plant_id', 'skill'])
export class Certification extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 32, nullable: true })
  folio: string | null;

  /**
   * Optional FK-by-value to an `hr_employees` row (kept denormalized/loosely
   * coupled). Nullable so legacy certs (name-only) remain valid; the matrix
   * falls back to `employeeName` when this is null.
   */
  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true, name: 'employee_id' })
  employeeId: string | null;

  @Index()
  @Column({ type: 'varchar', length: 160, name: 'employee_name' })
  employeeName: string;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'employee_email' })
  employeeEmail: string | null;

  @Index()
  @Column({ type: 'varchar', length: 160 })
  skill: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  area: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  station: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'certified_by' })
  certifiedBy: string | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'issued_date' })
  issuedDate: Date | null;

  @Index()
  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'expires_date' })
  expiresDate: Date | null;
}
