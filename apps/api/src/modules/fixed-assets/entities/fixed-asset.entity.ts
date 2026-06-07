import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';

export type FixedAssetStatus = 'IN_SERVICE' | 'DISPOSED';

/**
 * A capitalized fixed asset (FIN). Folio from the central numbering service
 * (docType FIXED_ASSET → FA-…). Fully additive table `fixed_assets`.
 * Depreciation (monthly / accumulated / book value) is derived at read time from
 * the pure `depreciation` helpers — not stored.
 */
@Entity('fixed_assets')
@Index('idx_fa_scope_status', ['tenant_id', 'plant_id', 'status'])
export class FixedAsset extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 32, nullable: true })
  folio: string | null;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  category: string | null;

  @Column({ type: 'float', default: 0, name: 'acquisition_cost' })
  acquisitionCost: number;

  @Column({ type: 'float', default: 0, name: 'salvage_value' })
  salvageValue: number;

  @Column({ type: 'int', default: 0, name: 'useful_life_months' })
  usefulLifeMonths: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'varchar', length: 16, default: 'STRAIGHT_LINE' })
  method: string;

  @Column({ type: 'varchar', length: 12, default: 'IN_SERVICE' })
  status: FixedAssetStatus;

  @Column({ type: 'varchar', length: 160, nullable: true })
  location: string | null;

  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true, name: 'program_id' })
  programId: string | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'acquisition_date' })
  acquisitionDate: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'disposed_at' })
  disposedAt: Date | null;
}
