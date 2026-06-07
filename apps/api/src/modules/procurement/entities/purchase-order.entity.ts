import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';
import type { PurchaseOrderStatus } from '../po-state';

export type PurchaseOrderPriority = 'LOW' | 'MEDIUM' | 'HIGH';

/**
 * A purchase order (Procurement / MM). Folio from the central numbering service
 * (docType PURCHASE_ORDER → PO-…). Fully additive table. Supplier is
 * denormalized (name + loose id) to stay decoupled from the suppliers module.
 * Dates back OTD (on-time delivery) KPIs.
 */
@Entity('purchase_orders')
@Index('idx_po_scope_status', ['tenant_id', 'plant_id', 'status'])
export class PurchaseOrder extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 32, nullable: true })
  folio: string | null;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'supplier_name' })
  supplierName: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true, name: 'supplier_id' })
  supplierId: string | null;

  @Column({ type: 'varchar', length: 16, default: 'DRAFT' })
  status: PurchaseOrderStatus;

  @Column({ type: 'varchar', length: 8, default: 'MEDIUM' })
  priority: PurchaseOrderPriority;

  @Column({ type: 'float', default: 0, name: 'total_value' })
  totalValue: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  buyer: string | null;

  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true, name: 'program_id' })
  programId: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'issued_at' })
  issuedAt: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'required_date' })
  requiredDate: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'promised_date' })
  promisedDate: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'received_date' })
  receivedDate: Date | null;
}
