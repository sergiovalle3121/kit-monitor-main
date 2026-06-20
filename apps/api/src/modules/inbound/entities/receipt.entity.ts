import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';
import type { ReceiptStatus } from '../receipt-state';

export type IqcResult = 'PASS' | 'FAIL';

/**
 * An inbound material receipt + IQC record (Recibo / Inbound). Folio from the
 * central numbering service (docType RECEIPT → RCV-…). Fully additive table
 * `inbound_receipts` (prefixed to avoid clashing with other modules). Supplier
 * and PO are denormalized. `receivedAt`/`releasedAt` back the dock-to-stock KPI.
 */
@Entity('inbound_receipts')
@Index('idx_receipt_scope_status', ['tenant_id', 'plant_id', 'status'])
export class Receipt extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 32, nullable: true })
  folio: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'supplier_name' })
  supplierName: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true, name: 'po_folio' })
  poFolio: string | null;

  @Index()
  @Column({ type: 'varchar', length: 80, name: 'part_number' })
  partNumber: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  description: string | null;

  @Column({ type: 'float', default: 0 })
  quantity: number;

  @Column({ type: 'varchar', length: 12, default: 'PCS' })
  uom: string;

  @Column({ type: 'varchar', length: 64, nullable: true, name: 'lot_number' })
  lotNumber: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true, name: 'serial_number' })
  serialNumber: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true, name: 'date_code' })
  dateCode: string | null;

  @Column({ type: 'varchar', length: 12, default: 'RECEIVED' })
  status: ReceiptStatus;

  @Column({ type: 'varchar', length: 4, nullable: true, name: 'iqc_result' })
  iqcResult: IqcResult | null;

  @Column({ type: 'varchar', length: 48, nullable: true, name: 'reject_code' })
  rejectCode: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'received_by' })
  receivedBy: string | null;

  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true, name: 'program_id' })
  programId: string | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'received_at' })
  receivedAt: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'released_at' })
  releasedAt: Date | null;

  // Putaway target + whether the released stock was posted to inventory.
  @Column({ type: 'varchar', length: 32, default: 'WH-RAW', name: 'warehouse_id' })
  warehouseId: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  location: string | null;

  @Column({ type: 'boolean', default: false, name: 'inventory_posted' })
  inventoryPosted: boolean;
}
