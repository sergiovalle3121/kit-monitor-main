/**
 * Shared types + presentation metadata for the NPI dashboard. Mirrors the
 * backend `npi` module contracts (apps/api/src/modules/npi). Advisory only.
 */

export type ProjectStatus = 'OPEN' | 'ON_HOLD' | 'RELEASED' | 'CANCELLED';
export type GatePhase = 'QUOTE' | 'DFM' | 'EVT' | 'DVT' | 'PVT' | 'MP';
export type GateStatus = 'PENDING' | 'PASSED' | 'FAILED' | 'WAIVED';
export type ReadinessStatus = 'READY' | 'NOT_READY' | 'UNKNOWN';
export type GateDecision = 'PASSED' | 'FAILED' | 'WAIVED';

export const PHASES: GatePhase[] = ['QUOTE', 'DFM', 'EVT', 'DVT', 'PVT', 'MP'];

export interface NpiGate {
  id: string;
  projectId: string;
  phase: GatePhase;
  status: GateStatus;
  decidedByEmail?: string | null;
  decidedAt?: string | null;
  notes?: string | null;
}

export interface ReadinessCriterion {
  key: string;
  label: string;
  status: ReadinessStatus;
  detail: string;
}

/**
 * Raw release signals the backend resolves read-only from the modules that own
 * them (BOM, FAI, routing/line, AVL). Mirrors `ReadinessSignals` in
 * apps/api/src/modules/npi/npi.readiness.ts. A `null` field means "could not be
 * resolved" → reported UNKNOWN, never assumed good.
 */
export interface ReadinessSignals {
  bomStatus?: string | null;
  faiStatus?: string | null;
  lineBalancePct?: number | null;
  lineCompletenessPct?: number | null;
  stdTimeComplete?: boolean | null;
  avlCoverage?: number | null;
  /** Advisory dependency signals (counts; 0 = none yet, null = unresolved). */
  visualAidsActive?: number | null;
  productionWorkOrders?: number | null;
  toolingAssets?: number | null;
}

export interface ReadinessReport {
  model: string;
  revision: string;
  criteria: ReadinessCriterion[];
  gateReady: boolean;
  readyCount: number;
  notReadyCount: number;
  unknownCount: number;
  blockers: string[];
  unknowns: string[];
  signals?: ReadinessSignals | Record<string, unknown>;
}

/** Light per-project rollup for launch cards (from ?withReadiness=true). */
export interface NpiProjectSummary {
  gateReady: boolean;
  readyCount: number;
  notReadyCount: number;
  unknownCount: number;
  criteriaTotal: number;
  gatesCleared: number;
  gatesTotal: number;
  openRisks: number;
  openHighRisks: number;
}

export interface NpiProject {
  id: string;
  modelNumber: string;
  revision: string;
  /** Soft link to the canonical ProductModel (pm_product_models.id), if any. */
  productModelId?: string | null;
  /** Present when fetched with ?withReadiness=true. */
  summary?: NpiProjectSummary;
  customer?: string | null;
  currentPhase: GatePhase;
  status: ProjectStatus;
  programId?: string | null;
  notes?: string | null;
  created_at?: string;
  releasedAt?: string | null;
  releasedBy?: string | null;
  releaseNote?: string | null;
  gates?: NpiGate[];
  readiness?: ReadinessReport;
}

export interface ReadinessSnapshot {
  id: string;
  projectId?: string | null;
  modelNumber: string;
  revision: string;
  phase?: string | null;
  reason: string;
  gateReady: boolean;
  readyCount: number;
  notReadyCount: number;
  unknownCount: number;
  blockers?: string[] | null;
  note?: string | null;
  created_at?: string;
}

export type NpiRiskSeverity = 'LOW' | 'MEDIUM' | 'HIGH';
export type NpiRiskStatus = 'OPEN' | 'MITIGATING' | 'CLOSED';

export interface NpiRisk {
  id: string;
  projectId: string;
  title: string;
  description?: string | null;
  severity: NpiRiskSeverity;
  status: NpiRiskStatus;
  owner?: string | null;
  dueDate?: string | null;
  mitigation?: string | null;
  created_at?: string;
}

export const PROJECT_STATUS_META: Record<
  ProjectStatus,
  { label: string; color: string }
> = {
  OPEN: { label: 'Abierto', color: '#3b82f6' },
  ON_HOLD: { label: 'En espera', color: '#f59e0b' },
  RELEASED: { label: 'Liberado', color: '#10b981' },
  CANCELLED: { label: 'Cancelado', color: '#9ca3af' },
};

export const RISK_SEVERITY_META: Record<
  NpiRiskSeverity,
  { label: string; color: string }
> = {
  HIGH: { label: 'Alto', color: '#f43f5e' },
  MEDIUM: { label: 'Medio', color: '#f59e0b' },
  LOW: { label: 'Bajo', color: '#3b82f6' },
};

export const RISK_STATUS_META: Record<
  NpiRiskStatus,
  { label: string; color: string }
> = {
  OPEN: { label: 'Abierto', color: '#f43f5e' },
  MITIGATING: { label: 'Mitigando', color: '#f59e0b' },
  CLOSED: { label: 'Cerrado', color: '#10b981' },
};

export const GATE_STATUS_META: Record<
  GateStatus,
  { label: string; color: string }
> = {
  PENDING: { label: 'Pendiente', color: '#9ca3af' },
  PASSED: { label: 'Aprobado', color: '#10b981' },
  FAILED: { label: 'Rechazado', color: '#f43f5e' },
  WAIVED: { label: 'Exento', color: '#8b5cf6' },
};

export const READINESS_META: Record<
  ReadinessStatus,
  { label: string; color: string }
> = {
  READY: { label: 'Listo', color: '#10b981' },
  NOT_READY: { label: 'No listo', color: '#f43f5e' },
  UNKNOWN: { label: 'Desconocido', color: '#9ca3af' },
};

export const PHASE_LABEL: Record<GatePhase, string> = {
  QUOTE: 'Cotización',
  DFM: 'DFM',
  EVT: 'EVT',
  DVT: 'DVT',
  PVT: 'PVT',
  MP: 'Producción (MP)',
};

/** Legal next decisions for a gate, mirroring npi-state.ts. */
export function gateDecisions(status: GateStatus): GateDecision[] {
  if (status === 'PENDING') return ['PASSED', 'FAILED', 'WAIVED'];
  if (status === 'FAILED') return ['PASSED', 'WAIVED'];
  return [];
}

export function fmtDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('es-MX', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
}
