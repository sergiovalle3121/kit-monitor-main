import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';
import type { ShipmentStatus } from '../shipment-state';

export type Incoterm =
  | 'EXW'
  | 'FCA'
  | 'FOB'
  | 'CIF'
  | 'DAP'
  | 'DDP'
  | 'OTHER';

/**
 * An outbound shipment of finished goods (Logistics / Embarque). Folio from the
 * central numbering service (docType SHIPMENT → SHP-…). Fully additive table;
 * customer is denormalized to avoid coupling with other modules. Dates back the
 * on-time-delivery (OTD to customer) KPI.
 */
// NOTE: table is `outbound_shipments` (not `shipments`) to avoid colliding with
// the legacy `shipping` module's existing `shipments` table (integer PK).
@Entity('outbound_shipments')
@Index('idx_outbound_scope_status', ['tenant_id', 'plant_id', 'status'])
export class Shipment extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 32, nullable: true })
  folio: string | null;

  @Index()
  @Column({ type: 'varchar', length: 32, nullable: true })
  asn: string | null;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'customer_name' })
  customerName: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  destination: string | null;

  @Column({ type: 'varchar', length: 8, default: 'DAP' })
  incoterm: Incoterm;

  @Column({ type: 'varchar', length: 16, default: 'PACKING' })
  status: ShipmentStatus;

  @Column({ type: 'varchar', length: 120, nullable: true })
  carrier: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true, name: 'tracking_number' })
  trackingNumber: string | null;

  @Column({ type: 'int', default: 0, name: 'package_count' })
  packageCount: number;

  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true, name: 'program_id' })
  programId: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'promised_date' })
  promisedDate: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'shipped_date' })
  shippedDate: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'delivered_date' })
  deliveredDate: Date | null;
}
