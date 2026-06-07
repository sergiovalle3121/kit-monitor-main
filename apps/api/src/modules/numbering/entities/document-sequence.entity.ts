import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import type { ResetPolicy } from '../numbering.format';

/**
 * A configurable counter for one document type, scoped per tenant + plant.
 * Central source of folios for the whole platform (WO, PO, NCR, ASN…).
 *
 * `nextValue` is the number that will be assigned on the next allocation; it may
 * reset to 1 when `resetPolicy` rolls over (tracked by `periodKey`).
 * `totalIssued` is monotonic and never resets — it backs the all-time KPI.
 */
@Entity('document_sequences')
@Index('idx_docseq_scope_type', ['tenant_id', 'plant_id', 'docType'])
export class DocumentSequence extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 64, name: 'doc_type' })
  docType: string;

  @Column({ type: 'varchar', length: 120, default: '' })
  name: string;

  @Column({ type: 'varchar', length: 16, default: '' })
  prefix: string;

  @Column({ type: 'varchar', length: 64, default: '{PREFIX}-{YYYY}-{SEQ}' })
  pattern: string;

  @Column({ type: 'int', default: 6 })
  padding: number;

  @Column({ type: 'int', default: 1, name: 'next_value' })
  nextValue: number;

  @Column({ type: 'int', default: 0, name: 'total_issued' })
  totalIssued: number;

  @Column({ type: 'varchar', length: 16, default: 'NEVER', name: 'reset_policy' })
  resetPolicy: ResetPolicy;

  @Column({ type: 'varchar', length: 16, nullable: true, name: 'period_key' })
  periodKey: string | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;
}
