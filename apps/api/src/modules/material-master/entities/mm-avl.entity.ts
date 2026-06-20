import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import type { AvlStatus } from '../material-state';

/**
 * MmAvl — Approved Vendor (Manufacturer) List per material. One internal part
 * number maps to many manufacturer part numbers (the EMS key): manufacturer +
 * MPN + approval status + preference rank + lead time.
 *
 * Child of MmMaterial via `materialId` (uuid). Additive, prefixed table.
 */
@Entity('mm_avl')
@Index('idx_mm_avl_material', ['tenant_id', 'materialId'])
@Index('uq_mm_avl_material_mpn', ['materialId', 'manufacturer', 'mpn'], {
  unique: true,
})
export class MmAvl extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid', name: 'material_id' })
  materialId: string;

  @Column({ type: 'varchar', length: 160 })
  manufacturer: string;

  /** Manufacturer part number. */
  @Column({ type: 'varchar', length: 120 })
  mpn: string;

  @Column({ type: 'varchar', length: 16, default: 'PENDING' })
  status: AvlStatus;

  /** Preference rank: 1 = preferred. Lower is better. */
  @Column({ type: 'int', default: 1 })
  preference: number;

  @Column({ type: 'int', name: 'lead_time_days', nullable: true })
  leadTimeDays: number | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
