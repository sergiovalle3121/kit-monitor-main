import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';

/**
 * A skill / training certification for an employee (RH / Capital Humano).
 * Self-contained and additive: the employee is denormalized (name + email) to
 * avoid coupling with the users module. The live status (VALID / EXPIRING /
 * EXPIRED) is derived from `expiresDate` at read time — not stored.
 */
@Entity('certifications')
@Index('idx_cert_scope_skill', ['tenant_id', 'plant_id', 'skill'])
export class Certification extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 32, nullable: true })
  folio: string | null;

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
