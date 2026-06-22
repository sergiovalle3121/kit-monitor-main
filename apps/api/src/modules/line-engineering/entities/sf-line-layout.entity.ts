import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';

/**
 * 2D layout canvas config for a model+revision (the "plano" the Industrial
 * Engineer arranges stations on): footprint size, working unit and grid step.
 *
 * This is the per-line/cell floor configuration — NOT per station. The station
 * coordinates live additively on `sf_line_stations` (layout_x/y/w/h/rotation).
 *
 * Net-new, fully additive table: it does not touch the routing/balance flow nor
 * the logical `bay_layouts` (NP→bahía) assignment. Scoped by tenant/plant so the
 * canvas is private per tenant, and keyed by model+revision to match how the
 * Line Engineering page selects a layout.
 */
@Entity('sf_line_layouts')
@Index('idx_sf_layout_scope', ['tenant_id', 'plant_id', 'model', 'revision'])
export class SfLineLayout extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  model: string;

  @Column({ type: 'varchar', length: 16, default: 'A' })
  revision: string;

  /** Footprint width (along X) in `unit`. */
  @Column({ type: 'float', default: 20000, name: 'footprint_w' })
  footprintW: number;

  /** Footprint length/height (along Y) in `unit`. */
  @Column({ type: 'float', default: 10000, name: 'footprint_h' })
  footprintH: number;

  /** Real-world unit the footprint/grid are expressed in: 'mm' or 'm'. */
  @Column({ type: 'varchar', length: 8, default: 'mm' })
  unit: string;

  /** Grid/snap step in `unit`. */
  @Column({ type: 'float', default: 500, name: 'grid_size' })
  gridSize: number;
}
