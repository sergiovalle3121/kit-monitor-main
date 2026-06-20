import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';

/**
 * A line of an outbound shipment — the structured "what am I shipping" (part,
 * quantity, lot, UoM) that the shipment fulfils, optionally tied to a sales-order
 * line (demand). Drives the finished-goods goods-issue at ship time:
 * `inventoryPosted` flips true once the FG inventory was decremented. Additive,
 * tenant-scoped, references the shipment by id (denormalized, like packing).
 */
@Entity('outbound_shipment_lines')
@Index('idx_outbound_line_scope', ['tenant_id', 'plant_id'])
export class OutboundShipmentLine extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 36, name: 'shipment_id' })
  shipmentId: string;

  @Index()
  @Column({ type: 'varchar', length: 64, name: 'part_number' })
  partNumber: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  description: string | null;

  @Column({ type: 'float', default: 0 })
  quantity: number;

  @Column({ type: 'float', default: 0, name: 'quantity_shipped' })
  quantityShipped: number;

  @Column({ type: 'varchar', length: 12, default: 'EA' })
  uom: string;

  @Column({ type: 'varchar', length: 64, nullable: true, name: 'lot_number' })
  lotNumber: string | null;

  @Column({
    type: 'varchar',
    length: 32,
    default: 'WH-FG',
    name: 'warehouse_id',
  })
  warehouseId: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  location: string | null;

  // Demand link (optional): the sales order / line this fulfils.
  @Column({ type: 'varchar', length: 32, nullable: true, name: 'sales_order' })
  salesOrder: string | null;

  @Column({
    type: 'varchar',
    length: 16,
    nullable: true,
    name: 'sales_order_line',
  })
  salesOrderLine: string | null;

  /** True once the finished-goods goods-issue posted for this line at ship time. */
  @Column({ type: 'boolean', default: false, name: 'inventory_posted' })
  inventoryPosted: boolean;

  // Pricing (optional) — drives the commercial invoice.
  @Column({ type: 'float', nullable: true, name: 'unit_price' })
  unitPrice: number | null;

  @Column({ type: 'varchar', length: 3, default: 'MXN' })
  currency: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
