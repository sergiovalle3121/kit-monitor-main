// ─────────────────────────────────────────────────────────────────────────────
// Quality domain types — mirror the real backend entities (zero mock). Source of
// truth: apps/api/src/modules/{ncr,quality,testing}. Kept in sync by hand because
// `packages/contracts` is not established yet (see AGENTS.md §3).
// ─────────────────────────────────────────────────────────────────────────────

// NCR — apps/api/src/modules/ncr/entities/ncr.entity.ts
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
  /** Clasificación opcional con el catálogo tipificado (defect_codes). Nullable. */
  defectCodeId?: number | null;
  description: string;
  sourceType: NcrSourceType;
  quantityAffected: number;
  lotNumber?: string | null;
  serialNumber?: string | null;
  workOrder?: string | null;
  building?: string | null;
  warehouse?: string | null;
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

/** Payload for POST /ncr (the controller binds `@Body() dto: any`). */
export interface CreateNcrInput {
  partNumber: string;
  category: string;
  description: string;
  severity: NcrSeverity;
  sourceType: NcrSourceType;
  quantityAffected: number;
  lotNumber?: string;
  serialNumber?: string;
  workOrder?: string;
  building?: string;
  line?: string;
  customer?: string;
  program?: string;
  model?: string;
  /** NOT NULL on the entity — the page injects the signed-in user. */
  createdBy: string;
}

// CAPA — apps/api/src/modules/quality/entities/capa.entity.ts
export type CapaStatus =
  | "open"
  | "investigation"
  | "action_defined"
  | "in_progress"
  | "effectiveness_review"
  | "closed";

export type CapaPriority = "low" | "medium" | "high" | "urgent";

export interface Capa {
  id: number;
  capaNumber: string;
  status: CapaStatus;
  priority: CapaPriority;
  partNumber: string;
  problemStatement: string;
  rootCause?: string | null;
  correctiveAction?: string | null;
  preventiveAction?: string | null;
  effectivenessCheck?: string | null;
  building?: string | null;
  line?: string | null;
  program?: string | null;
  createdBy: string;
  owner?: string | null;
  ncr?: { id: number; ncrNumber?: string } | null;
  createdAt: string;
  updatedAt: string;
}

// Testing KPIs — apps/api/src/modules/testing/testing.service.ts (TestingKpis)
export interface ParetoBucket {
  failureCode: string;
  count: number;
  pct: number;
}

export interface TestingKpis {
  totalTests: number;
  pass: number;
  fail: number;
  /** Overall yield = pass / total attempts. */
  yieldPct: number | null;
  /** First-Pass Yield = serials whose first test passed / distinct serials. */
  firstPassYieldPct: number | null;
  distinctSerials: number;
  pareto: ParetoBucket[];
}

/** Maestro de Modelo (espina dorsal) — para los dropdowns de modelo. */
export interface ModelOption {
  id: string;
  modelNumber: string;
  name: string;
  status: string;
}

// IQC — apps/api/src/modules/quality/entities/iqc-inspection.entity.ts
export type IqcResult = "pass" | "fail" | "conditional" | "pending";

export interface IqcInspection {
  id: number;
  inspectionNumber: string;
  partNumber: string;
  lotNumber?: string | null;
  result: IqcResult;
  sampleSize?: number | null;
  defectsFound?: number | null;
  inspector: string;
  notes?: string | null;
  warehouseId?: string | null;
  supplier?: { id: number | string; name?: string } | null;
  createdAt: string;
}

// OQC — apps/api/src/modules/quality/entities/final-inspection.entity.ts
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

/** OQC backlog = posiciones de inventario en estado pending_oqc. */
export interface OqcBacklogRow {
  id: number;
  partNumber: string;
  warehouseId: string;
  location: string;
  onHand: number;
  lotNumber?: string | null;
  serialNumber?: string | null;
  programId?: string | null;
}

// Inventory-level quality hold — apps/api/src/modules/quality/entities/quality-hold.entity.ts
export type QualityHoldLevel =
  | "PART_NUMBER"
  | "LOT"
  | "SERIAL"
  | "WAREHOUSE"
  | "BUILDING"
  | "PROGRAM"
  | "WORK_ORDER";

export interface QualityHold {
  id: number;
  partNumber: string;
  level: QualityHoldLevel;
  levelValue?: string | null;
  isActive: boolean;
  reason: string;
  heldBy: string;
  releasedBy?: string | null;
  releasedAt?: string | null;
  notes?: string | null;
  createdAt: string;
}

// Disposition engine — apps/api/src/modules/quality/entities/disposition.entity.ts
export type DispositionType = "release" | "scrap" | "rtv" | "rework" | "use_as_is";
export type DispositionStatus =
  | "proposed"
  | "under_review"
  | "approved"
  | "executed"
  | "closed";

export interface Disposition {
  id: number;
  type: DispositionType;
  status: DispositionStatus;
  reason: string;
  quantity: number;
  partNumber: string;
  warehouseId: string;
  location: string;
  proposedBy: string;
  approvedBy?: string | null;
  executedBy?: string | null;
  notes?: string | null;
  hold?: { id: number } | null;
  ncr?: { id: number; ncrNumber?: string } | null;
  createdAt: string;
}

// Defect code catalog — apps/api/src/modules/defect-codes/entities/defect-code.entity.ts
export type DefectFamily =
  | "solder"
  | "component"
  | "cosmetic"
  | "functional"
  | "mechanical"
  | "process";

export interface DefectCode {
  id: number;
  code: string;
  description: string;
  category: DefectFamily;
  defaultSeverity?: string | null;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// Quality analytics summary — apps/api/src/modules/quality-analytics/quality-analytics.service.ts
export interface DefectParetoRow {
  key: string;
  label: string;
  count: number;
  pct: number;
  cumPct: number;
  defectCodeId: number | null;
  category?: string;
  description?: string;
}

export interface SupplierPpm {
  supplierId: number | string | null;
  supplierName: string;
  inspections: number;
  inspected: number;
  defects: number;
  ppm: number | null;
}

export interface PpmPoint {
  period: string; // YYYY-MM
  inspected: number;
  defects: number;
  ppm: number | null;
}

export interface FpyGroup {
  key: string;
  serials: number;
  firstPass: number;
  fpy: number | null;
}

export interface CountRow {
  key: string;
  label: string;
  count: number;
}

export interface CapaOverdue {
  capaNumber: string;
  partNumber: string;
  status: string;
  dueDate: string | null;
  daysOverdue: number;
}

export interface CapaStats {
  total: number;
  open: number;
  closed: number;
  overdue: number;
  avgCloseDays: number | null;
  byStatus: { status: string; count: number }[];
  overdueList: CapaOverdue[];
}

export interface OqcYield {
  inspected: number;
  passed: number;
  failed: number;
  yieldPct: number | null;
}

export interface DispositionUnits {
  type: string;
  count: number;
  units: number;
}

export interface QualityAnalytics {
  generatedAt: string;
  filters: { days: number | null; model: string | null; line: string | null; supplier: string | null };
  meta: {
    totalNcrs: number;
    classifiedNcrs: number;
    unclassifiedNcrs: number;
    catalogSize: number;
  };
  defects: { pareto: DefectParetoRow[] };
  ppm: {
    supplier: SupplierPpm[];
    supplierOverall: number | null;
    supplierTrend: PpmPoint[];
    processOverall: number | null;
    processTrend: PpmPoint[];
    dpmoAvailable: false;
  };
  yield: {
    fpyOverall: number | null;
    serials: number;
    fpyByModel: FpyGroup[];
    fpyByStation: FpyGroup[];
    oqc: OqcYield;
  };
  cuts: {
    byModel: CountRow[];
    byLine: CountRow[];
    bySupplier: SupplierPpm[];
  };
  capa: CapaStats;
  dispositions: { byType: DispositionUnits[]; costAvailable: false };
}

// Quarantine transfer — apps/api/src/modules/quality/entities/quarantine-transfer.entity.ts
export type QuarantineTransferStatus = "pending" | "completed" | "cancelled";

export interface QuarantineTransfer {
  id: number;
  partNumber: string;
  quantity: number;
  sourceWarehouseId: string;
  sourceLocation: string;
  destWarehouseId: string;
  destLocation: string;
  status: QuarantineTransferStatus;
  requestedBy: string;
  completedBy?: string | null;
  hold?: { id: number } | null;
  createdAt: string;
}
