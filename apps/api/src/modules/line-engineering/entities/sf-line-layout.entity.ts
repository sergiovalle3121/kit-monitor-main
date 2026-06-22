import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { JSON_COLUMN_TYPE } from '../../../common/database/json-column-type';

/** A directed material-flow link between two stations (Fase 4). */
export interface LayoutConnector {
  from: string; // sf_line_stations.id
  to: string; // sf_line_stations.id
  kind?: string; // 'flow' | 'conveyor' | 'return'
}

/** A non-station equipment/asset dropped on the plan (Fase 5). */
export interface LayoutAsset {
  id: string; // client-generated id
  kind: string; // workbench | conveyor | rack | robot | aoi | oven | printer | wall | zone | label
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  label?: string;
}

/** A persistent annotation on the plan (Fase 7): free text or a dimension. */
export interface LayoutAnnotation {
  id: string;
  type: 'text' | 'dim'; // text label | dimension line (cota)
  x: number;
  y: number;
  x2?: number; // dim end point
  y2?: number;
  text?: string;
  color?: string;
}

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

  // ── DXF background (Fase 2) ────────────────────────────────────────────────
  // A read-only client/plant floor plan rendered behind the stations. Additive &
  // nullable: NULL `dxf_data` = no background. The placement columns position the
  // drawing over the footprint (in the layout's unit) and are inert when absent.
  @Column({ type: 'text', nullable: true, name: 'dxf_data' })
  dxfData: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'dxf_name' })
  dxfName: string | null;

  @Column({ type: 'float', default: 0, name: 'dxf_offset_x' })
  dxfOffsetX: number;

  @Column({ type: 'float', default: 0, name: 'dxf_offset_y' })
  dxfOffsetY: number;

  @Column({ type: 'float', default: 1, name: 'dxf_scale' })
  dxfScale: number;

  /** Rotation of the DXF in degrees (clockwise). */
  @Column({ type: 'float', default: 0, name: 'dxf_rotation' })
  dxfRotation: number;

  @Column({ type: 'boolean', default: true, name: 'dxf_visible' })
  dxfVisible: boolean;

  @Column({ type: 'float', default: 0.5, name: 'dxf_opacity' })
  dxfOpacity: number;

  // ── Flow connectors (Fase 4) ───────────────────────────────────────────────
  // Directed material-flow links between stations, drawn as arrows on the plan.
  // Additive & nullable: NULL/empty = no flow drawn.
  @Column({ type: JSON_COLUMN_TYPE, nullable: true })
  connectors: LayoutConnector[] | null;

  // ── Equipment / assets (Fase 5) ────────────────────────────────────────────
  // Non-station objects placed on the plan (benches, conveyors, racks, robots,
  // walls, zones, labels…). Additive & nullable.
  @Column({ type: JSON_COLUMN_TYPE, nullable: true })
  assets: LayoutAsset[] | null;

  // ── Annotations (Fase 7) ───────────────────────────────────────────────────
  // Free-text labels and dimension lines (cotas) drawn on the plan. Additive.
  @Column({ type: JSON_COLUMN_TYPE, nullable: true })
  annotations: LayoutAnnotation[] | null;
}
