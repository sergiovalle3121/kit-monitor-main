import {
  Entity, PrimaryGeneratedColumn, Column, Index, Unique, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';

/**
 * AVL — Approved Vendor List. The structural backbone that says *which supplier
 * is approved to supply which part*, with its sourcing terms. This is the
 * quality/SQE approval artifact (PPAP/PSW disposition), distinct from the MRP
 * pricing catalog (`erp_supplier_prices`) which only carries price/lead time.
 *
 * Additive table `supplier_approved_parts`. References the supplier by its
 * integer id (matching the non-tenant-scoped Supplier master) and the part by
 * its string part number (matching IQC / receipts / SCAR / price records), so a
 * part's approved sources cross-reference cleanly with its real performance.
 */
@Entity('supplier_approved_parts')
@Unique(['supplierId', 'partNumber'])
export class SupplierApprovedPart {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'int', name: 'supplier_id' })
  supplierId: number;

  @Index()
  @Column({ type: 'varchar', length: 100, name: 'part_number' })
  partNumber: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  description?: string;

  /** Commodity / category for this sourcing, e.g. "Pasivos", "PCB". */
  @Column({ type: 'varchar', length: 80, nullable: true })
  commodity?: string;

  /** APPROVED | CONDITIONAL | PENDING | DISQUALIFIED. */
  @Column({ type: 'varchar', length: 16, default: 'PENDING', name: 'approval_status' })
  approvalStatus: string;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'approved_at' })
  approvedAt?: Date;

  @Column({ type: 'varchar', length: 120, nullable: true, name: 'approved_by' })
  approvedBy?: string;

  /** Quoted unit price for this part from this supplier (nullable). */
  @Column({ type: 'float', nullable: true, name: 'unit_price' })
  unitPrice?: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  /** Minimum order quantity (nullable). */
  @Column({ type: 'float', nullable: true })
  moq?: number;

  /** Lead-time override for this part (days). Falls back to the supplier's. */
  @Column({ type: 'int', nullable: true, name: 'lead_time_days' })
  leadTimeDays?: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
