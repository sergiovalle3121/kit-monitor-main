import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import type { HandlingUnitStatus, HandlingUnitType } from '../packing.rules';

export interface HandlingUnitContent {
  partNumber: string;
  quantity: number;
  serials?: string[];
}

/**
 * Handling unit (Unidad de manejo) — a pallet / carton / box that carries product
 * for an outbound shipment, identified by a GS1 SSCC. Additive, tenant-scoped,
 * prefixed table `packing_handling_units`. References the shipment by id
 * (denormalized, like genealogy) so the module stays self-contained. `parentId`
 * nests cartons inside a pallet. `contents` is the scan-verifiable manifest.
 */
@Entity('packing_handling_units')
@Index('idx_packing_hu_scope', ['tenant_id', 'plant_id'])
export class HandlingUnit extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true, name: 'shipment_id' })
  shipmentId: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true, name: 'shipment_folio' })
  shipmentFolio: string | null;

  @Index()
  @Column({ type: 'varchar', length: 18, nullable: true })
  sscc: string | null;

  /** True when the SSCC used the placeholder prefix (no real GS1 prefix configured). */
  @Column({ type: 'boolean', default: false, name: 'sscc_placeholder' })
  ssccPlaceholder: boolean;

  @Column({ type: 'varchar', length: 16, default: 'CARTON' })
  type: HandlingUnitType;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true, name: 'parent_id' })
  parentId: string | null;

  @Column({ type: 'varchar', length: 16, default: 'OPEN' })
  status: HandlingUnitStatus;

  @Column({ type: 'float', nullable: true, name: 'weight_kg' })
  weightKg: number | null;

  @Column({ type: 'float', nullable: true, name: 'length_cm' })
  lengthCm: number | null;

  @Column({ type: 'float', nullable: true, name: 'width_cm' })
  widthCm: number | null;

  @Column({ type: 'float', nullable: true, name: 'height_cm' })
  heightCm: number | null;

  // Portable JSON (text storage) so the same entity materializes on SQLite (tests)
  // and Postgres (smoke/prod) without a jsonb dependency.
  @Column({ type: 'simple-json', nullable: true })
  contents: HandlingUnitContent[] | null;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'ship_to_name' })
  shipToName: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'ship_to_address' })
  shipToAddress: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'from_name' })
  fromName: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true, name: 'po_number' })
  poNumber: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
