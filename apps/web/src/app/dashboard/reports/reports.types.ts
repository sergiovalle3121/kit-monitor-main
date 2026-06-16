// ─────────────────────────────────────────────────────────────────────────────
// Reports lane — local types. These MIRROR real backend shapes (zero mock); they
// are duplicated here (instead of imported from other lanes) so the reports
// section stays self-contained. Source of truth lives in apps/api/src/modules:
//   plans · outbound · quality(testing/oqc) · ncr · genealogy · production-runtime
// Kept in sync by hand because `packages/contracts` is not established yet
// (see AGENTS.md §3). When a field is absent at its source it is `null`/optional
// here — the UI then renders an honest empty marker instead of inventing data.
// ─────────────────────────────────────────────────────────────────────────────

// ── Work Order (Plan) — apps/api/src/modules/plans/entities/plan.entity.ts ──────
export interface WorkOrder {
  id: number;
  workOrder: string;
  model: string;
  line: number;
  quantity: number;
  shift: string;
  status: string;
  priority?: string;
  buildingId?: string | null;
  dueDate?: string | null;
  scheduledAt?: string | null;
  releasedAt?: string | null;
  publishedAt?: string | null;
  publishedBy?: string | null;
  createdAt?: string;
  // NOTE: the Plan entity carries NO customer / program / revision columns. The
  // CoC surfaces those as honest gaps unless a matching shipment/NCR supplies them.
}

// ── Outbound shipment — apps/api/src/modules/outbound/entities/shipment.entity.ts
export type ShipmentStatus =
  | "PACKING"
  | "READY"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED";

export interface Shipment {
  id: string;
  folio: string | null;
  asn: string | null;
  title: string;
  customerName: string | null;
  destination: string | null;
  incoterm: string;
  status: ShipmentStatus;
  carrier: string | null;
  trackingNumber: string | null;
  packageCount: number;
  programId: string | null;
  notes: string | null;
  promisedDate: string | null;
  shippedDate: string | null;
  deliveredDate: string | null;
  // NOTE: outbound shipments do NOT carry line items (serials/parts). Per-unit
  // content of a shipment is an honest gap → flagged REQUIERE BACKEND in the CoC.
}

// ── OQC final inspection — apps/api/src/modules/quality/entities/final-inspection
export type OqcResult = "PASS" | "FAIL" | "CONDITIONAL";

export interface FinalInspection {
  id: number;
  workOrder: string;
  partNumber: string;
  quantityInspected: number;
  quantityPassed: number;
  quantityFailed: number;
  result: OqcResult;
  inspector?: string | null;
  defectType?: string | null;
  defectDescription?: string | null;
  severity?: string | null;
  notes?: string | null;
  createdAt: string;
}

// ── NCR — apps/api/src/modules/ncr/entities/ncr.entity.ts ────────────────────────
export type NcrStatus =
  | "open"
  | "under_review"
  | "contained"
  | "dispositioned"
  | "closed";
export type NcrSeverity = "minor" | "major" | "critical";
export type NcrSourceType =
  | "incoming"
  | "in-process"
  | "outgoing"
  | "warehouse"
  | "supplier"
  | "customer";

export interface Ncr {
  id: number;
  ncrNumber: string;
  status: NcrStatus;
  severity: NcrSeverity;
  partNumber: string;
  category: string;
  description: string;
  sourceType: NcrSourceType;
  quantityAffected: number;
  lotNumber?: string | null;
  serialNumber?: string | null;
  workOrder?: string | null;
  line?: string | null;
  customer?: string | null;
  program?: string | null;
  model?: string | null;
  createdBy: string;
  owner?: string | null;
  dispositionNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Testing KPIs — apps/api/src/modules/testing/testing.service.ts ──────────────
export interface ParetoBucket {
  failureCode: string;
  count: number;
  pct: number;
}

export interface TestingKpis {
  totalTests: number;
  pass: number;
  fail: number;
  yieldPct: number | null;
  firstPassYieldPct: number | null;
  distinctSerials: number;
  pareto: ParetoBucket[];
}

// ── Genealogy AS-BUILT — apps/api/src/modules/genealogy/genealogy.derivation.ts ──
export interface AsBuiltConsumption {
  lot: string | null;
  reel: string | null;
  qty: number;
  station: string | null;
  operator: string | null;
  consumedAt: string | null;
  woId: string | null;
  woFolio: string | null;
  source: string;
}

export interface AsBuiltComponent {
  part: string;
  totalQty: number;
  lots: string[];
  reels: string[];
  consumptions: AsBuiltConsumption[];
}

export interface AsBuiltTree {
  serial: string;
  model: string | null;
  woId: string | null;
  woFolio: string | null;
  componentCount: number;
  parts: AsBuiltComponent[];
  /** True when at least one component link is missing lot capture (honest gap). */
  lotCaptureGap: boolean;
  firstBuiltAt: string | null;
  lastBuiltAt: string | null;
}

// ── Production runtime line — apps/api/.../production-runtime.service buildBackendView
export interface RuntimeLine {
  kitId: number;
  lineCode: string;
  line: number | string;
  model: string;
  workOrder: string;
  shift: string | null;
  targetQty: number;
  completedQty: number;
  status: string;
  hasIncident: boolean;
  receivedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  lowStockCount: number;
}
