/**
 * Launch Command Center — pure, presentation-free helpers that fold the data
 * AXOS already exposes (NPI readiness signals, gates, product-model lookup) into
 * the views an NPI engineer actually needs: a dependency matrix ("which AXOS
 * modules are ready?") and an actionable "what's missing to release" list.
 *
 * Honesty rule (mirrors the backend readiness aggregator): a signal we cannot
 * resolve is `pending`/`unknown`, NEVER assumed good. Nothing here invents data.
 */

import {
  GatePhase,
  NpiGate,
  NpiRisk,
  PHASES,
  ProjectStatus,
  ReadinessReport,
  ReadinessSignals,
} from './npi';

/* ───────────────────────────── Phase rail ───────────────────────────── */

export interface PhaseRailItem {
  phase: GatePhase;
  /** How many projects currently sit in this phase. */
  count: number;
  /** True for the phase a single project is currently in (detail view). */
  current?: boolean;
  /** True once a project has cleared past this phase (detail view). */
  done?: boolean;
}

/** Count open/in-flight projects per phase for the list rail. */
export function phaseRailCounts(
  projects: { currentPhase: GatePhase; status: ProjectStatus }[],
): PhaseRailItem[] {
  return PHASES.map((phase) => ({
    phase,
    count: projects.filter(
      (p) => p.currentPhase === phase && p.status !== 'CANCELLED',
    ).length,
  }));
}

/** Per-phase state for a single project's gate timeline. */
export function phaseRailForProject(
  currentPhase: GatePhase,
  status: ProjectStatus,
): PhaseRailItem[] {
  const currentIdx = PHASES.indexOf(currentPhase);
  const released = status === 'RELEASED';
  return PHASES.map((phase, idx) => ({
    phase,
    count: 0,
    current: !released && idx === currentIdx,
    done: released || idx < currentIdx,
  }));
}

/* ─────────────────────────── Dependency matrix ─────────────────────────── */

export type DependencyStatus =
  | 'connected' // resolved and in a good state
  | 'partial' // resolved but incomplete / not yet ready
  | 'missing' // nothing exists yet
  | 'pending'; // not wired into AXOS readiness yet (no backend signal)

export interface LaunchDependency {
  key: string;
  label: string;
  status: DependencyStatus;
  detail: string;
  /** Dashboard route to go fix/inspect this dependency. */
  href: string;
}

export const DEPENDENCY_STATUS_META: Record<
  DependencyStatus,
  { label: string; color: string }
> = {
  connected: { label: 'Conectado', color: '#10b981' },
  partial: { label: 'Incompleto', color: '#f59e0b' },
  missing: { label: 'Falta', color: '#f43f5e' },
  pending: { label: 'Sin integrar', color: '#9ca3af' },
};

/** Narrow the loosely-typed report.signals into the known signal shape. */
export function readSignals(report?: ReadinessReport | null): ReadinessSignals {
  return (report?.signals as ReadinessSignals) ?? {};
}

function bomDependency(s: ReadinessSignals, href: string): LaunchDependency {
  const status = s.bomStatus;
  if (!status)
    return {
      key: 'bom',
      label: 'BOM · Lista de materiales',
      status: 'missing',
      detail: 'Sin BOM para el modelo.',
      href,
    };
  const good = status === 'APPROVED' || status === 'ACTIVE';
  return {
    key: 'bom',
    label: 'BOM · Lista de materiales',
    status: good ? 'connected' : 'partial',
    detail: good ? `BOM ${status}.` : `BOM en ${status} (falta aprobar).`,
    href,
  };
}

function avlDependency(s: ReadinessSignals, href: string): LaunchDependency {
  const cov = s.avlCoverage;
  if (cov == null)
    return {
      key: 'avl',
      label: 'Material Master / AVL',
      status: 'missing',
      detail: 'Sin partes para evaluar fuentes aprobadas.',
      href,
    };
  const full = cov >= 1;
  return {
    key: 'avl',
    label: 'Material Master / AVL',
    status: full ? 'connected' : 'partial',
    detail: `Cobertura AVL ${pct(cov)}.`,
    href,
  };
}

function routingDependency(s: ReadinessSignals, href: string): LaunchDependency {
  const noRouting =
    s.lineBalancePct == null &&
    s.lineCompletenessPct == null &&
    s.stdTimeComplete == null;
  if (noRouting)
    return {
      key: 'routing',
      label: 'Proceso · Routing',
      status: 'missing',
      detail: 'Sin ruteo para el modelo.',
      href,
    };
  const balanced = (s.lineBalancePct ?? 0) >= 0.85;
  const documented = (s.lineCompletenessPct ?? 0) >= 1;
  const timed = s.stdTimeComplete === true;
  const good = balanced && documented && timed;
  return {
    key: 'routing',
    label: 'Proceso · Routing',
    status: good ? 'connected' : 'partial',
    detail: `Balance ${pct(s.lineBalancePct)} · doc ${pct(
      s.lineCompletenessPct,
    )} · tiempos ${s.stdTimeComplete == null ? '—' : timed ? 'ok' : 'incompletos'}.`,
    href,
  };
}

/** A count-based dependency: null → pending, 0 → missing, ≥1 → connected. */
function countDependency(
  key: string,
  label: string,
  count: number | null | undefined,
  href: string,
  noun: string,
): LaunchDependency {
  if (count == null)
    return {
      key,
      label,
      status: 'pending',
      detail: 'Aún sin señal de readiness en AXOS.',
      href,
    };
  if (count <= 0)
    return {
      key,
      label,
      status: 'missing',
      detail: `Sin ${noun} para el modelo.`,
      href,
    };
  return { key, label, status: 'connected', detail: `${count} ${noun}.`, href };
}

function qualityDependency(s: ReadinessSignals, href: string): LaunchDependency {
  const fai = s.faiStatus;
  if (!fai)
    return {
      key: 'quality',
      label: 'Calidad · FAI',
      status: 'missing',
      detail: 'Sin FAI registrada.',
      href,
    };
  return {
    key: 'quality',
    label: 'Calidad · FAI',
    status: fai === 'PASS' ? 'connected' : 'partial',
    detail: `FAI ${fai}.`,
    href,
  };
}

/**
 * Build the dependency matrix from the live readiness signals plus whether the
 * canonical product model could be resolved. Every dependency now has a real
 * signal: counts (tooling, visual aids, production plan) resolve null → pending,
 * 0 → missing, ≥1 → connected. Tooling is program-scoped (count for the model's
 * program), so it stays `pending` only when the model has no program.
 */
export function deriveDependencies(
  report: ReadinessReport | null | undefined,
  opts: { modelResolved: boolean; modelHref: string },
): LaunchDependency[] {
  const s = readSignals(report);
  return [
    {
      key: 'product',
      label: 'Product Model',
      status: opts.modelResolved ? 'connected' : 'missing',
      detail: opts.modelResolved
        ? 'Modelo maestro vinculado.'
        : 'Sin modelo maestro para este número.',
      href: opts.modelHref,
    },
    bomDependency(s, opts.modelHref),
    avlDependency(s, '/dashboard/suppliers'),
    routingDependency(s, '/dashboard/routing'),
    countDependency(
      'tooling',
      'Tooling / Fixtures',
      s.toolingAssets,
      '/dashboard/tooling',
      'herramental(es) del programa',
    ),
    countDependency(
      'visualAids',
      'Visual Aids / WI',
      s.visualAidsActive,
      '/dashboard/visual-aids',
      'ayuda(s) visual(es) activa(s)',
    ),
    qualityDependency(s, '/dashboard/quality'),
    countDependency(
      'plan',
      'Plan de producción',
      s.productionWorkOrders,
      '/dashboard/production-plan',
      'orden(es) de trabajo',
    ),
  ];
}

/* ──────────────────────── What's missing to release ──────────────────────── */

export type MissingSeverity = 'blocker' | 'verify';

export interface MissingItem {
  key: string;
  label: string;
  detail: string;
  severity: MissingSeverity;
}

/** A risk still weighs on the launch until it is CLOSED. */
export function openRisks(risks: NpiRisk[] = []): NpiRisk[] {
  return risks.filter((r) => r.status !== 'CLOSED');
}

/**
 * Fold readiness criteria, gate states and open risks into one actionable list:
 * NOT_READY criteria, FAILED gates and HIGH open risks are `blocker`s; UNKNOWN
 * criteria, PENDING gates and other open risks are `verify` items. Pure — uses
 * only data the project already carries.
 */
export function deriveMissing(
  report: ReadinessReport | null | undefined,
  gates: NpiGate[],
  risks: NpiRisk[] = [],
): MissingItem[] {
  const items: MissingItem[] = [];

  for (const c of report?.criteria ?? []) {
    if (c.status === 'NOT_READY')
      items.push({
        key: `crit:${c.key}`,
        label: c.label,
        detail: c.detail,
        severity: 'blocker',
      });
    else if (c.status === 'UNKNOWN')
      items.push({
        key: `crit:${c.key}`,
        label: c.label,
        detail: c.detail,
        severity: 'verify',
      });
  }

  const openGates = gates.filter(
    (g) => g.status === 'PENDING' || g.status === 'FAILED',
  );
  for (const g of openGates)
    items.push({
      key: `gate:${g.id}`,
      label: `Gate ${g.phase}`,
      detail: g.status === 'FAILED' ? 'Gate rechazado.' : 'Gate sin decidir.',
      severity: g.status === 'FAILED' ? 'blocker' : 'verify',
    });

  for (const r of openRisks(risks))
    items.push({
      key: `risk:${r.id}`,
      label: `Riesgo: ${r.title}`,
      detail: r.owner ? `Owner ${r.owner}` : 'Sin owner asignado',
      severity: r.severity === 'HIGH' ? 'blocker' : 'verify',
    });

  return items;
}

/**
 * True only when nothing blocks: readiness green, every gate cleared, and no
 * open HIGH-severity risk.
 */
export function canRelease(
  report: ReadinessReport | null | undefined,
  gates: NpiGate[],
  risks: NpiRisk[] = [],
): boolean {
  const allGatesPassed =
    gates.length > 0 &&
    gates.every((g) => g.status === 'PASSED' || g.status === 'WAIVED');
  const noHighRisk = !openRisks(risks).some((r) => r.severity === 'HIGH');
  return Boolean(report?.gateReady) && allGatesPassed && noHighRisk;
}

/* ───────────────────────────── small utils ───────────────────────────── */

function pct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${Math.round(value * 1000) / 10}%`;
}

/** Aggregate gate progress for a project (passed+waived / total). */
export function gateProgress(gates: NpiGate[]): {
  cleared: number;
  total: number;
} {
  const cleared = gates.filter(
    (g) => g.status === 'PASSED' || g.status === 'WAIVED',
  ).length;
  return { cleared, total: gates.length };
}
