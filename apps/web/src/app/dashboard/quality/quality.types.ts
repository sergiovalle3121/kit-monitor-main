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
