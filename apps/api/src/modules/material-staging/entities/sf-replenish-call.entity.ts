import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';
import type { ReplenishStatus } from '../staging-status';

/**
 * An e-kanban replenishment call (pull) from a station to the warehouse (Block C).
 * Raised automatically when staged material drops under the kanban point, or
 * manually on a shortage. Carries a timer (raisedAt → deliveredAt) for the
 * replenishment-time KPI.
 */
@Entity('sf_replenish_calls')
@Index('idx_sf_replenish_scope', ['tenant_id', 'plant_id', 'status'])
@Index('idx_sf_replenish_wo', ['woId'])
export class SfReplenishCall extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 36, name: 'wo_id' })
  woId: string;

  @Column({ type: 'varchar', length: 32, nullable: true, name: 'wo_folio' })
  woFolio: string | null;

  @Column({ type: 'varchar', length: 32 })
  station: string;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  part: string;

  @Column({ type: 'float', default: 0 })
  qty: number;

  @Column({ type: 'varchar', length: 8, default: 'MEDIUM' })
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

  @Column({ type: 'varchar', length: 16, default: 'OPEN' })
  status: ReplenishStatus;

  @Column({ type: 'varchar', length: 32, nullable: true })
  reason: string | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'raised_at' })
  raisedAt: Date | null;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'raised_by' })
  raisedBy: string | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'delivered_at' })
  deliveredAt: Date | null;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'delivered_by' })
  deliveredBy: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true, name: 'program_id' })
  programId: string | null;
}
