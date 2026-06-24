import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';
import type { OutboundShipmentStatus } from '../shipment-state';

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

  // Demand link (SD): the sales order this shipment fulfils. When set, shipping
  // routes the goods-issue + COGS + fulfilment through the ERP sales order.
  @Index()
  @Column({ type: 'int', nullable: true, name: 'sales_order_id' })
  salesOrderId: number | null;

  @Column({ type: 'varchar', length: 32, nullable: true, name: 'sales_order_number' })
  salesOrderNumber: string | null;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'customer_name' })
  customerName: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  destination: string | null;

  @Column({ type: 'varchar', length: 8, default: 'DAP' })
  incoterm: Incoterm;

  @Column({ type: 'varchar', length: 16, default: 'PACKING' })
  status: OutboundShipmentStatus;

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

  // ── Transport assignment (Tráfico) ─────────────────────────────────────────
  // Denormalized snapshot of the carrier/unit/driver/dock tied to this shipment
  // by traffic. The structured ids point at the `traffic_*` masters; the *_plate/
  // *_code/driver_name carry a human snapshot so the document/label survives even
  // if a master row changes later. `carrier` (above) holds the carrier name.
  @Column({ type: 'varchar', length: 36, nullable: true, name: 'carrier_id' })
  carrierId: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'vehicle_id' })
  vehicleId: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true, name: 'vehicle_plate' })
  vehiclePlate: string | null;

  @Column({ type: 'varchar', length: 24, nullable: true, name: 'vehicle_type' })
  vehicleType: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'driver_id' })
  driverId: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true, name: 'driver_name' })
  driverName: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'dock_id' })
  dockId: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true, name: 'dock_code' })
  dockCode: string | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'transport_assigned_at' })
  transportAssignedAt: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'transport_assigned_by' })
  transportAssignedBy: string | null;
}
