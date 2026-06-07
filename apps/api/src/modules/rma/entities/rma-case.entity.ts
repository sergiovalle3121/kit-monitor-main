import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';
import type { RmaDisposition, RmaStatus } from '../rma-state';

export type RmaSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * A customer return / complaint case (RMA, Quality). Folio from the central
 * numbering service (docType RMA → RMA-…). Fully additive table `rma_cases`;
 * customer/part denormalized. `openedAt`/`closedAt` back the cycle-time KPI.
 */
@Entity('rma_cases')
@Index('idx_rma_scope_status', ['tenant_id', 'plant_id', 'status'])
export class RmaCase extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 32, nullable: true })
  folio: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'customer_name' })
  customerName: string | null;

  @Index()
  @Column({ type: 'varchar', length: 80, nullable: true, name: 'part_number' })
  partNumber: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true, name: 'serial_number' })
  serialNumber: string | null;

  @Column({ type: 'varchar', length: 255, name: 'failure_description' })
  failureDescription: string;

  @Column({ type: 'varchar', length: 12, default: 'MEDIUM' })
  severity: RmaSeverity;

  @Column({ type: 'varchar', length: 16, default: 'OPEN' })
  status: RmaStatus;

  @Column({ type: 'varchar', length: 12, nullable: true })
  disposition: RmaDisposition | null;

  @Column({ type: 'text', nullable: true, name: 'root_cause' })
  rootCause: string | null;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true, name: 'program_id' })
  programId: string | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'opened_at' })
  openedAt: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'closed_at' })
  closedAt: Date | null;
}
