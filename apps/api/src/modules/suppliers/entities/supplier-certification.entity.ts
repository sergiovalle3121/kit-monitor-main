import {
  Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';

/**
 * A supplier quality/compliance certification with an expiry the system can
 * watch (ISO 9001, IATF 16949, ISO 13485, AS9100, ISO 14001, RoHS, REACH,
 * conflict-minerals). Expiring certs drive compliance alerts on the 360 and KPIs.
 * Additive table `supplier_certifications`.
 */
@Entity('supplier_certifications')
export class SupplierCertification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'tenant_id' })
  tenant_id: string | null;

  @Index()
  @Column({ type: 'int', name: 'supplier_id' })
  supplierId: number;

  /** Standard code, e.g. ISO9001, IATF16949, ISO13485, AS9100, ISO14001, ROHS, REACH. */
  @Column({ type: 'varchar', length: 32 })
  standard: string;

  @Column({ type: 'varchar', length: 80, nullable: true, name: 'cert_number' })
  certNumber?: string;

  @Column({ type: 'varchar', length: 120, nullable: true, name: 'issued_by' })
  issuedBy?: string;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'issued_at' })
  issuedAt?: Date;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'expires_at' })
  expiresAt?: Date;

  /** VALID | EXPIRING | EXPIRED | REVOKED (derived, but stored for filtering). */
  @Column({ type: 'varchar', length: 16, default: 'VALID' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
