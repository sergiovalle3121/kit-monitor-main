import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';

/**
 * RtOperation — one ordered step in a routing: sequence number, work center,
 * standard setup/run times, description and an optional visual-aid / instruction
 * reference. New prefixed table (`rt_operation`), additive, tenant-scoped.
 */
@Entity('rt_operation')
@Index('idx_rt_operation_routing', ['tenant_id', 'routingId'])
@Index('uq_rt_operation_seq', ['routingId', 'sequence'], { unique: true })
export class RtOperation extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid', name: 'routing_id' })
  routingId: string;

  /** Operation number (10, 20, 30…). */
  @Column({ type: 'int', default: 10 })
  sequence: number;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  /** Work center / station where the operation runs. */
  @Column({ type: 'varchar', length: 120, nullable: true, name: 'work_center' })
  workCenter: string | null;

  /** Standard setup time (minutes, once per lot). */
  @Column({ type: 'float', name: 'setup_time_min', default: 0 })
  setupTimeMin: number;

  /** Standard run time per finished unit (minutes). */
  @Column({ type: 'float', name: 'run_time_per_unit_min', default: 0 })
  runTimePerUnitMin: number;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** Reference to a visual aid / work instruction. */
  @Column({ type: 'varchar', length: 120, nullable: true, name: 'visual_aid_ref' })
  visualAidRef: string | null;
}
