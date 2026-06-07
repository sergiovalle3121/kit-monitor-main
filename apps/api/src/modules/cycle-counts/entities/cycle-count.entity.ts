import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';
import type { CycleCountStatus } from '../count-state';

/**
 * A cycle count of one part at one location (inventory accuracy). Folio from the
 * central numbering service (docType CYCLE_COUNT → CC-…). Fully additive table
 * `cycle_counts`. `variance = countedQty - systemQty` (stored on count).
 */
@Entity('cycle_counts')
@Index('idx_cc_scope_status', ['tenant_id', 'plant_id', 'status'])
export class CycleCount extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 32, nullable: true })
  folio: string | null;

  @Index()
  @Column({ type: 'varchar', length: 80, name: 'part_number' })
  partNumber: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  location: string | null;

  @Column({ type: 'varchar', length: 12, default: 'PCS' })
  uom: string;

  @Column({ type: 'float', default: 0, name: 'system_qty' })
  systemQty: number;

  @Column({ type: 'float', nullable: true, name: 'counted_qty' })
  countedQty: number | null;

  /** countedQty - systemQty; null until counted. */
  @Column({ type: 'float', nullable: true })
  variance: number | null;

  @Column({ type: 'varchar', length: 12, default: 'OPEN' })
  status: CycleCountStatus;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'counted_by' })
  countedBy: string | null;

  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true, name: 'program_id' })
  programId: string | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'counted_at' })
  countedAt: Date | null;
}
