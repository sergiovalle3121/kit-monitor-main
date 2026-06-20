import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import type { RoutingStatus } from '../routing-logic';

/**
 * RtRouting — the routing HEADER for ONE assembly material + revision. Its ordered
 * operations define how the assembly is built (work centers, standard times) and
 * which materials are consumed at each operation (for correct backflush).
 *
 * Linked to the material master by `materialId`. New prefixed table (`rt_routing`),
 * additive, tenant-scoped. Coexists with the legacy `process_steps` routing.
 */
@Entity('rt_routing')
@Index('uq_rt_routing_scope_material_rev', ['tenant_id', 'plant_id', 'materialId', 'revision'], { unique: true })
@Index('idx_rt_routing_scope_status', ['tenant_id', 'plant_id', 'status'])
export class RtRouting extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The assembly material this routing is for (FK → mm_material). */
  @Index()
  @Column({ type: 'uuid', name: 'material_id' })
  materialId: string;

  @Column({ type: 'varchar', length: 20, default: '1.0' })
  revision: string;

  @Column({ type: 'varchar', length: 16, default: 'DRAFT' })
  status: RoutingStatus;

  @Column({ type: 'varchar', length: 160, nullable: true })
  name: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, any> | null;
}
