import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';

/**
 * Additive serial → shipment link (the "tomb" side of cradle-to-grave). Lets the
 * where-used recall query go from a defective lot/reel → built serials → the
 * shipments (and customers) that contain them. Populated by the `linkShipment`
 * hook (callable at pack-out / ASN time); shipment fields are denormalized so the
 * genealogy module never couples to the shipping schema. Prefixed, additive,
 * nullable/defaulted; idempotent via `idempotency_key`.
 */
@Entity('sf_genealogy_shipment')
@Index('idx_sf_gens_scope', ['tenant_id', 'plant_id'])
export class SfGenealogyShipment extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 160, name: 'idempotency_key' })
  idempotencyKey: string;

  @Index()
  @Column({ type: 'varchar', length: 80, name: 'built_serial' })
  builtSerial: string;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true, name: 'shipment_id' })
  shipmentId: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true, name: 'shipment_folio' })
  shipmentFolio: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  asn: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'customer_name' })
  customerName: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  destination: string | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'shipped_at' })
  shippedAt: Date | null;

  @Column({ type: 'varchar', length: 64, nullable: true, name: 'program_id' })
  programId: string | null;
}
