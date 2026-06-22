// ─────────────────────────────────────────────────────────────────────────────
// Reports lane — pure helpers (no React, no I/O). Side-effect free so they can be
// reused across every report document and unit-tested in isolation. Everything
// here works ONLY on data the backend already returns; nothing is fabricated.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  AsBuiltTree,
  FinalInspection,
  Ncr,
  NcrSeverity,
  NcrStatus,
  RuntimeLine,
} from "./reports.types";

// ── Formatting ──────────────────────────────────────────────────────────────
export function fmtDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-MX", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtDay(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-MX", {
    year: "numeric",
    month: "long",
    day: "2-digit",
  });
}

/** A value that may be empty — render an em dash instead of blank/"null". */
export function orDash(value?: string | number | null): string {
  if (value === null || value === undefined) return "—";
  const s = String(value).trim();
  return s.length ? s : "—";
}

export function pct(part: number, total: number): number {
  if (!total || total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

// ── Document control numbers ─────────────────────────────────────────────────
// Fallback DRAFT control id, used WHILE no official folio has been issued. The CoC
// can now issue a real folio via POST /numbering/issue (docType COC); this
// client-derived number is just the draft state shown before that issuance.
export function draftDocNumber(prefix: string, subject: string, when = new Date()): string {
  const stamp = `${when.getFullYear()}${String(when.getMonth() + 1).padStart(2, "0")}${String(
    when.getDate(),
  ).padStart(2, "0")}`;
  const slug = (subject || "NA")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 18);
  return `${prefix}-${stamp}-${slug || "NA"}`;
}

// ── NCR derivations ──────────────────────────────────────────────────────────
export function isNcrOpen(status: NcrStatus): boolean {
  return status !== "closed";
}

export interface NcrSummary {
  total: number;
  open: number;
  closed: number;
  critical: number;
  byStatus: Record<NcrStatus, number>;
  bySeverity: Record<NcrSeverity, number>;
}

const NCR_STATUSES: NcrStatus[] = [
  "open",
  "under_review",
  "contained",
  "dispositioned",
  "closed",
];
const NCR_SEVERITIES: NcrSeverity[] = ["minor", "major", "critical"];

export function summarizeNcrs(rows: Ncr[]): NcrSummary {
  const byStatus = Object.fromEntries(NCR_STATUSES.map((s) => [s, 0])) as Record<NcrStatus, number>;
  const bySeverity = Object.fromEntries(NCR_SEVERITIES.map((s) => [s, 0])) as Record<
    NcrSeverity,
    number
  >;
  for (const n of rows) {
    if (byStatus[n.status] !== undefined) byStatus[n.status] += 1;
    if (bySeverity[n.severity] !== undefined) bySeverity[n.severity] += 1;
  }
  return {
    total: rows.length,
    open: rows.filter((n) => isNcrOpen(n.status)).length,
    closed: rows.filter((n) => n.status === "closed").length,
    critical: rows.filter((n) => n.severity === "critical" && isNcrOpen(n.status)).length,
    byStatus,
    bySeverity,
  };
}

/** NCRs that reference a given work order (case-insensitive, trimmed). */
export function ncrsForWorkOrder(rows: Ncr[], workOrder: string): Ncr[] {
  const key = workOrder.trim().toLowerCase();
  if (!key) return [];
  return rows.filter((n) => (n.workOrder ?? "").trim().toLowerCase() === key);
}

// ── Pareto (count desc + cumulative %) ───────────────────────────────────────
export interface ParetoRow {
  label: string;
  count: number;
  pct: number;
  cumPct: number;
}

export function paretoOf(items: { label: string; count: number }[]): ParetoRow[] {
  const sorted = items.filter((i) => i.count > 0).sort((a, b) => b.count - a.count);
  const total = sorted.reduce((s, i) => s + i.count, 0);
  let cum = 0;
  return sorted.map((i) => {
    cum += i.count;
    return {
      label: i.label,
      count: i.count,
      pct: pct(i.count, total),
      cumPct: pct(cum, total),
    };
  });
}

export function ncrCategoryPareto(rows: Ncr[]): ParetoRow[] {
  const counts = new Map<string, number>();
  for (const n of rows) {
    const key = (n.category || "Sin categoría").trim() || "Sin categoría";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return paretoOf([...counts.entries()].map(([label, count]) => ({ label, count })));
}

// ── Conformance verdict (CoC) ────────────────────────────────────────────────
export type Conformance = "conforme" | "condicional" | "no_conforme" | "sin_datos";

export interface ConformanceAssessment {
  verdict: Conformance;
  reasons: string[];
}

/**
 * Derive a conservative conformance verdict for a WO from the data we DO have:
 *   - OQC final inspection result (PASS / CONDITIONAL / FAIL)
 *   - open NCRs against the WO (any open critical → blocks; any open → qualifies)
 * Absent OQC evidence is reported as `sin_datos` (honest), never as conforme.
 */
export function assessConformance(
  oqc: FinalInspection | null,
  openNcrs: Ncr[],
): ConformanceAssessment {
  const reasons: string[] = [];
  const openCritical = openNcrs.filter((n) => n.severity === "critical" && isNcrOpen(n.status));
  const openAny = openNcrs.filter((n) => isNcrOpen(n.status));

  let verdict: Conformance = "sin_datos";

  if (oqc) {
    if (oqc.result === "FAIL") {
      verdict = "no_conforme";
      reasons.push(`Inspección OQC final con resultado RECHAZADO (${oqc.quantityFailed} rechazadas).`);
    } else if (oqc.result === "CONDITIONAL") {
      verdict = "condicional";
      reasons.push("Inspección OQC final con resultado CONDICIONAL.");
    } else if (oqc.result === "PASS") {
      verdict = "conforme";
      reasons.push(`Inspección OQC final APROBADA (${oqc.quantityPassed}/${oqc.quantityInspected}).`);
    }
  } else {
    reasons.push("Sin inspección OQC final registrada para esta orden de trabajo.");
  }

  if (openCritical.length > 0) {
    verdict = "no_conforme";
    reasons.push(`${openCritical.length} NCR crítica(s) abierta(s) contra la WO.`);
  } else if (openAny.length > 0 && verdict !== "no_conforme") {
    if (verdict === "conforme") verdict = "condicional";
    reasons.push(`${openAny.length} NCR abierta(s) contra la WO — liberación condicionada a disposición.`);
  }

  return { verdict, reasons };
}

// ── Production by shift aggregation ───────────────────────────────────────────
export interface ShiftGroup {
  shift: string;
  lines: RuntimeLine[];
  woCount: number;
  targetQty: number;
  completedQty: number;
  attainmentPct: number;
  incidents: number;
  lowStock: number;
}

/** Group runtime rows by their `shift` field (honest: "Sin turno" when absent). */
export function groupByShift(rows: RuntimeLine[]): ShiftGroup[] {
  const map = new Map<string, RuntimeLine[]>();
  for (const r of rows) {
    const key = (r.shift ?? "").toString().trim() || "Sin turno";
    const arr = map.get(key) ?? [];
    arr.push(r);
    map.set(key, arr);
  }
  return [...map.entries()]
    .map(([shift, lines]) => {
      const targetQty = lines.reduce((s, l) => s + (Number(l.targetQty) || 0), 0);
      const completedQty = lines.reduce((s, l) => s + (Number(l.completedQty) || 0), 0);
      return {
        shift,
        lines,
        woCount: new Set(lines.map((l) => l.workOrder)).size,
        targetQty,
        completedQty,
        attainmentPct: pct(completedQty, targetQty),
        incidents: lines.filter((l) => l.hasIncident).length,
        lowStock: lines.filter((l) => (l.lowStockCount ?? 0) > 0).length,
      };
    })
    .sort((a, b) => a.shift.localeCompare(b.shift));
}

/** Total units flagged with a lot-capture gap is the headline integrity signal. */
export function tracePartsWithGap(tree: AsBuiltTree | null): number {
  if (!tree) return 0;
  return tree.parts.filter((p) => p.consumptions.some((c) => !c.lot && !c.reel)).length;
}
