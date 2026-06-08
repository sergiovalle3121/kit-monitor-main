import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';
import type { ProductModelStatus } from '../product-model-state';

/**
 * ProductModel — the canonical master record for a product/model (NPI).
 *
 * This is the BACKBONE that ties together what used to be free-text `model`
 * strings scattered across BOM headers, plans and process routes. Capture a
 * model once here (auto folio `MDL-…` from DocumentNumberingService) and every
 * downstream area (BOM, planning, IE, staging, valuation) references the same
 * canonical number. Fully additive, prefixed table (`pm_`).
 */
@Entity('pm_product_models')
@Index('uq_pm_models_scope_number', ['tenant_id', 'plant_id', 'modelNumber'], {
  unique: true,
})
@Index('idx_pm_models_scope_status', ['tenant_id', 'plant_id', 'status'])
export class ProductModel extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Folio (DocumentNumberingService docType MODEL), e.g. MDL-00001. */
  @Index()
  @Column({ type: 'varchar', length: 40, name: 'model_number' })
  modelNumber: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'varchar', length: 160, nullable: true })
  customer: string | null;

  @Column({ type: 'varchar', length: 20, default: '1.0' })
  revision: string;

  @Column({ type: 'varchar', length: 16, default: 'DRAFT' })
  status: ProductModelStatus;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true, name: 'program_id' })
  programId: string | null;

  /** Free-form master data: customer program, notes, attributes, etc. */
  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'activated_at' })
  activatedAt: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'obsoleted_at' })
  obsoletedAt: Date | null;
}
