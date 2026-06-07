import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';
import type { MaintenanceOrderStatus } from '../order-state';

export type MaintenanceType = 'PREVENTIVE' | 'CORRECTIVE' | 'PREDICTIVE';
export type MaintenancePriority = 'LOW' | 'MEDIUM' | 'HIGH';

/**
 * A maintenance work order (CMMS). Folio from the central numbering service
 * (docType MAINTENANCE_ORDER → MO-…). Fully additive table.
 * `downtimeMinutes` and the started/completed timestamps back MTTR / availability.
 */
@Entity('maintenance_orders')
@Index('idx_mo_scope_status', ['tenant_id', 'plant_id', 'status'])
export class MaintenanceOrder extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 32, nullable: true })
  folio: string | null;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 12, default: 'CORRECTIVE' })
  type: MaintenanceType;

  @Column({ type: 'varchar', length: 8, default: 'MEDIUM' })
  priority: MaintenancePriority;

  @Column({ type: 'varchar', length: 16, default: 'OPEN' })
  status: MaintenanceOrderStatus;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true, name: 'asset_id' })
  assetId: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true, name: 'asset_name' })
  assetName: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'assigned_to' })
  assignedTo: string | null;

  @Column({ type: 'int', default: 0, name: 'downtime_minutes' })
  downtimeMinutes: number;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'due_date' })
  dueDate: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'started_at' })
  startedAt: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'completed_at' })
  completedAt: Date | null;
}
