import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';

export type AssetCriticality = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AssetStatus = 'RUNNING' | 'DOWN' | 'IDLE' | 'RETIRED';

/**
 * A maintainable asset / piece of equipment (CMMS). Fully additive table.
 */
@Entity('assets')
@Index('idx_asset_scope_status', ['tenant_id', 'plant_id', 'status'])
export class Asset extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 48, nullable: true })
  code: string | null;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  category: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  location: string | null;

  @Column({ type: 'varchar', length: 12, default: 'MEDIUM' })
  criticality: AssetCriticality;

  @Column({ type: 'varchar', length: 12, default: 'RUNNING' })
  status: AssetStatus;

  @Column({ type: 'varchar', length: 120, nullable: true })
  manufacturer: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  model: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true, name: 'serial_number' })
  serialNumber: string | null;
}
