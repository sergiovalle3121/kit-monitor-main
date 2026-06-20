import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';
import type {
  MakeBuy,
  MaterialItemType,
  MaterialLifecycle,
} from '../material-state';

/**
 * MmMaterial — the canonical, SAP-style MATERIAL MASTER record. The SINGLE
 * source of parts for the new multi-level BOM and routing. Tenant-scoped, with
 * an internal part number unique per (tenant, plant).
 *
 * Fully additive, prefixed table (`mm_`). Coexists with the legacy global
 * `material_master` (free-text, no tenant) exactly like `pm_product_models`
 * coexists with free-text `model` strings — the old one stays alive in parallel
 * until the supervised cut-over.
 */
@Entity('mm_material')
@Index('uq_mm_material_scope_number', ['tenant_id', 'plant_id', 'partNumber'], {
  unique: true,
})
@Index('idx_mm_material_scope_status', ['tenant_id', 'plant_id', 'lifecycle'])
@Index('idx_mm_material_scope_type', ['tenant_id', 'plant_id', 'itemType'])
export class MmMaterial extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Internal part number (folio MAT- if not supplied). Unique per scope. */
  @Index()
  @Column({ type: 'varchar', length: 60, name: 'part_number' })
  partNumber: string;

  @Column({ type: 'varchar', length: 255 })
  description: string;

  /** SAP-style item type. Stored as varchar (portable enum). */
  @Column({ type: 'varchar', length: 16, name: 'item_type', default: 'PURCHASED' })
  itemType: MaterialItemType;

  /** Item category / material group (free-form classification). */
  @Column({ type: 'varchar', length: 80, nullable: true })
  category: string | null;

  /** Base unit of measure. */
  @Column({ type: 'varchar', length: 16, name: 'base_uom', default: 'EA' })
  baseUom: string;

  /** Procurement strategy. */
  @Column({ type: 'varchar', length: 8, name: 'make_buy', default: 'BUY' })
  makeBuy: MakeBuy;

  /** Lifecycle status (state machine governed). */
  @Column({ type: 'varchar', length: 16, default: 'DRAFT' })
  lifecycle: MaterialLifecycle;

  @Column({ type: 'float', name: 'standard_cost', default: 0 })
  standardCost: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'float', nullable: true })
  weight: number | null;

  @Column({ type: 'varchar', length: 8, name: 'weight_uom', default: 'kg' })
  weightUom: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /** Free-form master data: spec attributes, links, etc. */
  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'activated_at' })
  activatedAt: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'obsoleted_at' })
  obsoletedAt: Date | null;
}
