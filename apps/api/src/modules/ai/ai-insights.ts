/**
 * CIDE "Centinela" — proactive situation report.
 *
 * Turns the read-only grounding tools into a prioritized "what needs my
 * attention now" list, cross-module and RBAC-filtered. Pure and deterministic:
 * it maps real tool outputs into ranked insights WITHOUT calling the LLM, so it
 * works even before the inference engine is provisioned. The service layer just
 * fetches the tool outputs and feeds them here; these mappers are unit-tested.
 */

export type InsightSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface Insight {
  area: string;
  severity: InsightSeverity;
  title: string;
  detail: string;
  /** A question that drills into this finding when clicked in the chat. */
  suggestedQuestion: string;
}

const SEVERITY_RANK: Record<InsightSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}
function s(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}
/** Coerce a Date | ISO string | epoch number to epoch ms, else undefined. */
function toTime(v: unknown): number | undefined {
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const t = new Date(v).getTime();
    return Number.isNaN(t) ? undefined : t;
  }
  return undefined;
}

/** KPIs crossing their target/trend → one insight each. */
export function kpiAlertsToInsights(out: unknown): Insight[] {
  return asArray(out).map((row) => {
    const r = asObj(row);
    const name = s(r.name) ?? s(r.key) ?? 'KPI';
    return {
      area: 'KPI',
      severity: s(r.severity) === 'critical' ? 'critical' : 'high',
      title: `KPI fuera de objetivo: ${name}`,
      detail: s(r.message) ?? '',
      suggestedQuestion: `¿Por qué ${name} está fuera de objetivo y qué acciones recomiendas?`,
    };
  });
}

/** Overdue maintenance orders → one aggregate insight. */
export function maintenanceToInsights(out: unknown, now: number): Insight[] {
  const overdue = asArray(out).filter((row) => {
    const r = asObj(row);
    const status = s(r.status);
    const open = status === 'OPEN' || status === 'IN_PROGRESS';
    const due = toTime(r.dueDate);
    return open && due !== undefined && due < now;
  });
  if (overdue.length === 0) return [];
  return [
    {
      area: 'Mantenimiento',
      severity: 'high',
      title: `${overdue.length} orden(es) de mantenimiento vencida(s)`,
      detail: 'Hay mantenimientos abiertos cuya fecha compromiso ya pasó.',
      suggestedQuestion:
        '¿Qué órdenes de mantenimiento están vencidas y cuáles debo priorizar?',
    },
  ];
}

/** Active quality holds → one aggregate insight. */
export function qualityHoldsToInsights(out: unknown): Insight[] {
  const active = asArray(out).filter((row) => asObj(row).isActive !== false);
  if (active.length === 0) return [];
  return [
    {
      area: 'Calidad',
      severity: 'high',
      title: `${active.length} retención(es) de calidad activa(s)`,
      detail: 'Hay material retenido pendiente de disposición.',
      suggestedQuestion:
        '¿Qué retenciones de calidad están activas y qué impacto tienen?',
    },
  ];
}

/** Open EHS incidents → one aggregate insight (critical if any is high-sev). */
export function ehsToInsights(out: unknown): Insight[] {
  const open = asArray(out).filter((row) => {
    const status = s(asObj(row).status);
    return status !== 'CLOSED' && status !== 'RESOLVED';
  });
  if (open.length === 0) return [];
  const anyCritical = open.some((row) => {
    const sev = s(asObj(row).severity)?.toUpperCase();
    return sev === 'CRITICAL' || sev === 'HIGH' || sev === 'SERIOUS';
  });
  return [
    {
      area: 'EHS',
      severity: anyCritical ? 'critical' : 'medium',
      title: `${open.length} incidente(s) de seguridad abierto(s)`,
      detail: anyCritical
        ? 'Hay incidentes de alta severidad sin cerrar.'
        : 'Hay incidentes de seguridad pendientes de cierre.',
      suggestedQuestion:
        '¿Qué incidentes de seguridad están abiertos y cuál es el más grave?',
    },
  ];
}

/** Combine per-source insights into a single ranked report (most severe first). */
export function buildSituationReport(
  sources: {
    kpiAlerts?: unknown;
    maintenance?: unknown;
    qualityHolds?: unknown;
    ehs?: unknown;
  },
  now: number,
): Insight[] {
  const insights: Insight[] = [
    ...kpiAlertsToInsights(sources.kpiAlerts),
    ...maintenanceToInsights(sources.maintenance, now),
    ...qualityHoldsToInsights(sources.qualityHolds),
    ...ehsToInsights(sources.ehs),
  ];
  return insights.sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity],
  );
}
