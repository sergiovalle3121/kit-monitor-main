import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { JSON_COLUMN_TYPE } from '../../../common/database/json-column-type';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';

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
  layer?: string; // CAD layer id this asset belongs to (Fase 66)
}

/**
 * A CAD layer (Fase 66): named, colored, with visibility and lock state. Objects
 * (assets/annotations) reference it by `id` via their optional `layer` field.
 * Additive: NULL/empty = everything lives on an implicit default layer.
 */
export interface LayoutLayer {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  locked: boolean;
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
  layer?: string; // CAD layer id this annotation belongs to (Fase 66)
}

/** A named manufacturing cell / zone grouping a set of stations (Fase 27). */
export interface LayoutCell {
  id: string;
  name: string;
  color: string;
  stationIds: string[]; // sf_line_stations.id members
}

/** A station placement captured inside a snapshot (Fase 13). */
export interface SnapshotPosition {
  id: string; // sf_line_stations.id
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
}

/**
 * A named, point-in-time copy of the layout arrangement (Fase 13) — a design
 * alternative the engineer can keep and restore. It stores the footprint,
 * station placements, flow, equipment and annotations, plus the DXF placement
 * metadata (NOT the raw drawing, which stays on the row to avoid bloat).
 */
export interface LayoutSnapshot {
  id: string;
  name: string;
  createdAt: string;
  createdBy?: string | null;
  footprint: {
    footprintW: number;
    footprintH: number;
    unit: string;
    gridSize: number;
  };
  positions: SnapshotPosition[];
  dxf?: {
    offsetX: number;
    offsetY: number;
    scale: number;
    rotation: number;
    visible: boolean;
    opacity: number;
  } | null;
  connectors: LayoutConnector[];
  assets: LayoutAsset[];
  annotations: LayoutAnnotation[];
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

  // ── Approval / sign-off lifecycle (Fase 29) ────────────────────────────────
  // The release state of the layout: draft → in_review → approved. Additive &
  // nullable: NULL approval_status = treated as 'draft'.
  @Column({
    type: 'varchar',
    length: 16,
    nullable: true,
    name: 'approval_status',
  })
  approvalStatus: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true, name: 'approved_by' })
  approvedBy: string | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'approved_at' })
  approvedAt: Date | null;

  @Column({
    type: 'varchar',
    length: 240,
    nullable: true,
    name: 'approval_note',
  })
  approvalNote: string | null;

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

  // ── Snapshots / versions (Fase 13) ─────────────────────────────────────────
  // Named, point-in-time copies of the arrangement the engineer can restore.
  // Additive & nullable: NULL/empty = no saved versions.
  @Column({ type: JSON_COLUMN_TYPE, nullable: true })
  snapshots: LayoutSnapshot[] | null;

  // ── Cells / zones (Fase 27) ────────────────────────────────────────────────
  // Named groupings of stations (manufacturing cells), drawn as a boundary on
  // the plan. Additive & nullable: NULL/empty = no cells.
  @Column({ type: JSON_COLUMN_TYPE, nullable: true })
  cells: LayoutCell[] | null;

  // ── CAD layers (Fase 66) ───────────────────────────────────────────────────
  // Named drafting layers with color/visibility/lock. Objects reference a layer
  // by id. Additive & nullable: NULL/empty = single implicit default layer.
  @Column({ type: JSON_COLUMN_TYPE, nullable: true })
  layers: LayoutLayer[] | null;
}
