// ─────────────────────────────────────────────────────────────────────────────
// Pure quality helpers: status/severity metadata, the NCR state machine (mirrors
// the backend enum order — the UI only offers valid forward transitions, while
// PATCH /ncr/:id/status itself is permissive), KPI derivation and Pareto math.
// Side-effect free so they can be reused across the cockpit, detail and analytics.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  Capa,
  CapaPriority,
  CapaStatus,
  Ncr,
  NcrSeverity,
  NcrSourceType,
  NcrStatus,
  ParetoBucket,
} from "./quality.types";

// ── NCR status ────────────────────────────────────────────────────────────────
export const NCR_STATUS_META: Record<NcrStatus, { label: string; color: string }> = {
  open: { label: "Abierta", color: "#ef4444" },
  under_review: { label: "En revisión", color: "#f59e0b" },
  contained: { label: "Contenida", color: "#3b82f6" },
  dispositioned: { label: "Dispuesta", color: "#7c3aed" },
  closed: { label: "Cerrada", color: "#10b981" },
};

export const NCR_STATUS_ORDER: NcrStatus[] = [
  "open",
  "under_review",
  "contained",
  "dispositioned",
  "closed",
];

// ── NCR severity ──────────────────────────────────────────────────────────────
export const NCR_SEVERITY_META: Record<NcrSeverity, { label: string; color: string }> = {
  minor: { label: "Menor", color: "#10b981" },
  major: { label: "Mayor", color: "#f59e0b" },
  critical: { label: "Crítica", color: "#ef4444" },
};

export const NCR_SEVERITY_ORDER: NcrSeverity[] = ["minor", "major", "critical"];

// ── NCR source ────────────────────────────────────────────────────────────────
export const NCR_SOURCE_META: Record<NcrSourceType, string> = {
  incoming: "Recibo (IQC)",
  "in-process": "En proceso",
  outgoing: "Salida (OQC)",
  warehouse: "Almacén",
  supplier: "Proveedor",
  customer: "Cliente",
};

export const NCR_SOURCE_ORDER: NcrSourceType[] = [
  "incoming",
  "in-process",
  "outgoing",
  "warehouse",
  "supplier",
  "customer",
];

/**
 * Valid forward transitions of the NCR lifecycle. The UI only surfaces these so a
 * user can't skip steps; the backend itself does not constrain the PATCH.
 */
const NCR_TRANSITIONS: Record<NcrStatus, NcrStatus[]> = {
  open: ["under_review"],
  under_review: ["contained"],
  contained: ["dispositioned"],
  dispositioned: ["closed"],
  closed: [],
};

export function nextNcrStates(from: NcrStatus): NcrStatus[] {
  return NCR_TRANSITIONS[from] ?? [];
}

export function isNcrOpen(status: NcrStatus): boolean {
  return status !== "closed";
}

// ── CAPA metadata ─────────────────────────────────────────────────────────────
export const CAPA_STATUS_META: Record<CapaStatus, { label: string; color: string }> = {
  open: { label: "Abierta", color: "#ef4444" },
  investigation: { label: "Investigación", color: "#f59e0b" },
  action_defined: { label: "Acción definida", color: "#3b82f6" },
  in_progress: { label: "En progreso", color: "#3b82f6" },
  effectiveness_review: { label: "Verificación", color: "#7c3aed" },
  closed: { label: "Cerrada", color: "#10b981" },
};

export const CAPA_PRIORITY_META: Record<CapaPriority, { label: string; color: string }> = {
  low: { label: "Baja", color: "#10b981" },
  medium: { label: "Media", color: "#f59e0b" },
  high: { label: "Alta", color: "#f97316" },
  urgent: { label: "Urgente", color: "#ef4444" },
};

export const CAPA_PRIORITY_ORDER: CapaPriority[] = ["low", "medium", "high", "urgent"];

// ── KPIs derived from the live NCR list (no /ncr/kpis endpoint exists) ──────────
export interface NcrKpis {
  total: number;
  open: number;
  critical: number;
  closed: number;
}

export function deriveNcrKpis(rows: Ncr[]): NcrKpis {
  return {
    total: rows.length,
    open: rows.filter((n) => isNcrOpen(n.status)).length,
    critical: rows.filter((n) => n.severity === "critical" && isNcrOpen(n.status)).length,
    closed: rows.filter((n) => n.status === "closed").length,
  };
}

// ── Pareto (count desc + cumulative %) ──────────────────────────────────────────
export interface ParetoRow {
  label: string;
  count: number;
  pct: number;
  cumPct: number;
}

function toPareto(items: { label: string; count: number }[]): ParetoRow[] {
  const sorted = items.filter((i) => i.count > 0).sort((a, b) => b.count - a.count);
  const total = sorted.reduce((sum, i) => sum + i.count, 0);
  let cum = 0;
  return sorted.map((i) => {
    cum += i.count;
    return {
      label: i.label,
      count: i.count,
      pct: total ? Math.round((i.count / total) * 1000) / 10 : 0,
      cumPct: total ? Math.round((cum / total) * 1000) / 10 : 0,
    };
  });
}

/** Pareto of NCR defect categories (real data from the NCR list). */
export function paretoByCategory(rows: Ncr[]): ParetoRow[] {
  const counts = new Map<string, number>();
  for (const n of rows) {
    const key = (n.category || "Sin categoría").trim() || "Sin categoría";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return toPareto([...counts.entries()].map(([label, count]) => ({ label, count })));
}

/** Pareto from the testing service's failure-code buckets (real data). */
export function paretoFromBuckets(buckets: ParetoBucket[]): ParetoRow[] {
  return toPareto(buckets.map((b) => ({ label: b.failureCode || "UNKNOWN", count: b.count })));
}

/**
 * First-Pass Yield as a pure number (the analytics screen uses the server-side
 * KPI; this stays available for derived/local views and is trivially testable).
 */
export function firstPassYield(pass: number, total: number): number | null {
  return total > 0 ? Math.round((pass / total) * 1000) / 10 : null;
}

/** CAPAs linked to a given NCR id (the list endpoint joins the `ncr` relation). */
export function capasForNcr(capas: Capa[], ncrId: number): Capa[] {
  return capas.filter((c) => c.ncr?.id === ncrId);
}
