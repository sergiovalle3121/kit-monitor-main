'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ChevronLeft,
  Loader2,
  Lock,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Rocket,
  History,
  ShieldCheck,
  AlertTriangle,
  Boxes,
  ListChecks,
  Network,
  ArrowRight,
} from 'lucide-react';
import { IconTile } from '@/components/ui/IconTile';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';
import { usePermissions } from '@/hooks/usePermissions';
import {
  fmtDate,
  GateDecision,
  gateDecisions,
  NpiGate,
  NpiProject,
  PHASE_LABEL,
  PHASES,
  ReadinessReport,
  ReadinessSnapshot,
} from '../_lib/npi';
import {
  canRelease,
  deriveDependencies,
  deriveMissing,
  gateProgress,
  LaunchDependency,
  MissingItem,
  phaseRailForProject,
} from '../_lib/launch';
import {
  DependencyStatusPill,
  GateStatusPill,
  ProjectStatusPill,
  ReadinessPill,
} from '../_lib/pills';

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
).replace(/\/$/, '');

interface ModelLite {
  id: string;
  modelNumber: string;
}

const DECISION_META: Record<
  GateDecision,
  { label: string; color: string; icon: typeof CheckCircle2 }
> = {
  PASSED: { label: 'Aprobar', color: '#10b981', icon: CheckCircle2 },
  FAILED: { label: 'Rechazar', color: '#f43f5e', icon: XCircle },
  WAIVED: { label: 'Eximir', color: '#8b5cf6', icon: MinusCircle },
};

export default function NpiProjectDetailPage() {
  const params = useParams();
  const id = String((params as Record<string, string>)?.id || '');
  const toast = useToast();
  const { canWrite } = usePermissions();

  const {
    data: project,
    isLoading,
    forbidden,
    mutate,
  } = useApi<NpiProject>(id ? `/npi/projects/${id}` : null);
  const { data: history, mutate: mutateHistory } = useApi<ReadinessSnapshot[]>(
    id ? `/npi/readiness/history?projectId=${id}&limit=20` : null,
  );
  // Resolve the canonical model (read-only) so the dependency matrix can link it.
  const { data: modelMatches } = useApi<ModelLite[]>(
    project
      ? `/product-models?search=${encodeURIComponent(project.modelNumber)}`
      : null,
  );

  const [deciding, setDeciding] = useState<{
    gateId: string;
    decision: GateDecision;
  } | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const gates = useMemo(
    () =>
      [...(project?.gates ?? [])].sort(
        (a, b) => PHASES.indexOf(a.phase) - PHASES.indexOf(b.phase),
      ),
    [project],
  );

  const model = useMemo(() => {
    if (!project) return null;
    return (
      (modelMatches ?? []).find(
        (m) => m.modelNumber === project.modelNumber,
      ) ?? null
    );
  }, [modelMatches, project]);

  const modelHref = model
    ? `/dashboard/models/${model.id}`
    : '/dashboard/models';

  const dependencies = useMemo(
    () =>
      deriveDependencies(project?.readiness, {
        modelResolved: !!model,
        modelHref,
      }),
    [project?.readiness, model, modelHref],
  );

  const missing = useMemo(
    () => deriveMissing(project?.readiness, gates),
    [project?.readiness, gates],
  );

  const releasable = useMemo(
    () => canRelease(project?.readiness, gates),
    [project?.readiness, gates],
  );

  async function decide() {
    if (!deciding) return;
    setBusy(true);
    try {
      const res = await apiFetch(
        `${API_BASE}/npi/gates/${deciding.gateId}/decide`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            decision: deciding.decision,
            notes: notes.trim() || undefined,
          }),
        },
      );
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d?.message || 'No se pudo decidir el gate.', 'NPI');
        return;
      }
      toast.success('Gate actualizado.', 'NPI');
      setDeciding(null);
      setNotes('');
      mutate();
      mutateHistory();
    } catch {
      toast.error('Error de red.', 'NPI');
    } finally {
      setBusy(false);
    }
  }

  if (forbidden) {
    return (
      <div className="min-h-screen grid place-items-center text-black dark:text-white">
        <div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}>
          <Lock className="w-8 h-8 mx-auto mb-3 text-gray-400" />
          <h2 className="text-lg font-semibold">Sin acceso</h2>
          <p className="text-sm text-gray-400 mt-1">
            Necesitas permiso de ingeniería para ver este proyecto.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading || !project) {
    return (
      <div className="flex justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const progress = gateProgress(gates);

  return (
    <div className="min-h-screen text-black dark:text-white font-sans pb-28">
      <main className="max-w-4xl mx-auto px-6 pt-8">
        <Link
          href="/dashboard/npi"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-black dark:hover:text-white mb-6"
        >
          <ChevronLeft className="w-4 h-4" /> Launch Center
        </Link>

        {/* Executive header */}
        <div className="flex items-start gap-4 mb-6">
          <IconTile domain="engineering" size={52} icon={Rocket} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-mono text-gray-500">
                {project.modelNumber}
              </span>
              <ProjectStatusPill status={project.status} />
              {project.readiness && (
                <ReadinessPill
                  status={project.readiness.gateReady ? 'READY' : 'NOT_READY'}
                />
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              {project.customer || 'Sin cliente'} · rev {project.revision}
            </h1>
            <p className="text-sm text-gray-500">
              Fase actual:{' '}
              <span className="font-medium">
                {PHASE_LABEL[project.currentPhase] ?? project.currentPhase}
              </span>
              {project.programId ? ` · Programa ${project.programId}` : ''} ·{' '}
              {progress.cleared}/{progress.total} gates
            </p>
          </div>
          <div className="ml-auto shrink-0">
            <Link
              href={modelHref}
              className="inline-flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
            >
              <Boxes className="w-4 h-4" /> {model ? 'Ver modelo' : 'Maestro'}
            </Link>
          </div>
        </div>

        {/* Release banner */}
        <ReleaseBanner releasable={releasable} blockers={missing} />

        {/* Phase timeline */}
        <PhaseTimeline
          currentPhase={project.currentPhase}
          status={project.status}
        />

        {/* Readiness */}
        {project.readiness && <ReadinessPanel report={project.readiness} />}

        {/* What's missing to release */}
        <MissingPanel items={missing} />

        {/* Dependency matrix */}
        <DependencyMatrix dependencies={dependencies} />

        {/* Gates */}
        <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-400 mt-8 mb-3">
          Gates de fase
        </h2>
        <div className="space-y-2.5">
          {gates.map((gate) => (
            <GateRow
              key={gate.id}
              gate={gate}
              canWrite={canWrite}
              isCurrent={gate.phase === project.currentPhase}
              onDecide={(decision) => {
                setNotes('');
                setDeciding({ gateId: gate.id, decision });
              }}
            />
          ))}
        </div>

        {/* History */}
        <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-400 mt-10 mb-3 flex items-center gap-2">
          <History className="w-4 h-4" /> Historial de readiness
        </h2>
        {history && history.length > 0 ? (
          <div
            className={`${glass} rounded-2xl divide-y divide-black/5 dark:divide-white/5`}
          >
            {history.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                <ReadinessPill status={s.gateReady ? 'READY' : 'NOT_READY'} />
                <span className="text-xs text-gray-400 w-32 shrink-0">
                  {fmtDate(s.created_at)}
                </span>
                <span className="text-xs font-medium">{s.reason}</span>
                <span className="text-xs text-gray-400 truncate flex-1">
                  {s.readyCount}✓ · {s.notReadyCount}✗ · {s.unknownCount}?
                  {s.note ? ` · ${s.note}` : ''}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div
            className={`${glass} rounded-2xl p-6 text-center text-sm text-gray-400`}
          >
            Aún no hay snapshots para este proyecto.
          </div>
        )}
      </main>

      {/* Decide modal */}
      {deciding && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
          onClick={() => !busy && setDeciding(null)}
        >
          <div
            className={`${glass} rounded-2xl p-5 w-full max-w-md`}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold mb-1">
              {DECISION_META[deciding.decision].label} gate
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Esta decisión es advisory y queda registrada. No activa el modelo.
            </p>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas / justificación (opcional)"
              className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setDeciding(null)}
                disabled={busy}
                className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                onClick={decide}
                disabled={busy}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: DECISION_META[deciding.decision].color }}
              >
                {busy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}{' '}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Top-of-dossier go/no-go banner answering "¿puedo liberar a MP?". */
function ReleaseBanner({
  releasable,
  blockers,
}: {
  releasable: boolean;
  blockers: MissingItem[];
}) {
  const hardBlockers = blockers.filter((b) => b.severity === 'blocker').length;
  return (
    <div
      className={`${glass} rounded-2xl p-4 mb-6 flex items-center gap-3`}
      style={{
        boxShadow: releasable ? 'inset 0 0 0 1px #10b98133' : undefined,
      }}
    >
      {releasable ? (
        <ShieldCheck className="w-5 h-5 shrink-0" style={{ color: '#10b981' }} />
      ) : (
        <AlertTriangle
          className="w-5 h-5 shrink-0"
          style={{ color: '#f59e0b' }}
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-sm">
          {releasable
            ? 'Listo para liberar a MP'
            : '¿Puedo producir esto mañana? Aún no.'}
        </div>
        <div className="text-xs text-gray-400">
          {releasable
            ? 'Readiness en verde y todos los gates resueltos. Decisión final advisory.'
            : `${blockers.length} pendiente(s) · ${hardBlockers} bloqueo(s) duro(s) antes de liberar.`}
        </div>
      </div>
    </div>
  );
}

/** Compact gate pipeline showing done / current / upcoming phases. */
function PhaseTimeline({
  currentPhase,
  status,
}: {
  currentPhase: NpiProject['currentPhase'];
  status: NpiProject['status'];
}) {
  const rail = phaseRailForProject(currentPhase, status);
  return (
    <div className={`${glass} rounded-2xl p-4 mb-6`}>
      <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-3">
        Pipeline · QUOTE → MP
      </div>
      <div className="flex items-stretch gap-1.5 overflow-x-auto">
        {rail.map((r, i) => {
          const color = r.current
            ? '#5b5bd6'
            : r.done
              ? '#10b981'
              : undefined;
          return (
            <React.Fragment key={r.phase}>
              <div
                className="flex-1 min-w-[4.5rem] rounded-xl px-2 py-2.5 text-center"
                style={{
                  background: color ? `${color}14` : undefined,
                  boxShadow: r.current ? `inset 0 0 0 1px ${color}55` : undefined,
                }}
              >
                <div
                  className="text-[12px] font-semibold"
                  style={{ color }}
                >
                  {r.phase}
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">
                  {r.done ? 'hecho' : r.current ? 'actual' : 'pendiente'}
                </div>
              </div>
              {i < rail.length - 1 && (
                <div className="self-center text-gray-300 dark:text-gray-600">
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

function ReadinessPanel({ report }: { report: ReadinessReport }) {
  const ready = report.gateReady;
  return (
    <div className={`${glass} rounded-2xl p-5 mb-6`}>
      <div className="flex items-center gap-3 mb-4">
        {ready ? (
          <ShieldCheck className="w-5 h-5" style={{ color: '#10b981' }} />
        ) : (
          <AlertTriangle className="w-5 h-5" style={{ color: '#f59e0b' }} />
        )}
        <div className="flex-1">
          <div className="font-semibold">
            {ready ? 'Listo para avanzar' : 'Aún no listo'}
          </div>
          <div className="text-xs text-gray-400">
            {report.readyCount} listo · {report.notReadyCount} no listo ·{' '}
            {report.unknownCount} desconocido
          </div>
        </div>
        <ReadinessPill status={ready ? 'READY' : 'NOT_READY'} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {report.criteria.map((c) => (
          <div
            key={c.key}
            className="flex items-start gap-2 rounded-xl px-3 py-2 bg-black/[0.02] dark:bg-white/[0.03]"
          >
            <ReadinessPill status={c.status} />
            <div className="min-w-0">
              <div className="text-sm font-medium">{c.label}</div>
              <div className="text-xs text-gray-400">{c.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Actionable "qué falta para liberar" list folded from readiness + gates. */
function MissingPanel({ items }: { items: MissingItem[] }) {
  return (
    <section className="mb-6">
      <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-400 mb-3 flex items-center gap-2">
        <ListChecks className="w-4 h-4" /> Qué falta para liberar
      </h2>
      {items.length === 0 ? (
        <div
          className={`${glass} rounded-2xl p-5 flex items-center gap-3 text-sm`}
        >
          <CheckCircle2 className="w-5 h-5" style={{ color: '#10b981' }} />
          <span>Nada pendiente. Todo resuelto para este launch.</span>
        </div>
      ) : (
        <div className={`${glass} rounded-2xl divide-y divide-black/5 dark:divide-white/5`}>
          {items.map((it) => {
            const blocker = it.severity === 'blocker';
            const color = blocker ? '#f43f5e' : '#f59e0b';
            return (
              <div key={it.key} className="flex items-start gap-3 px-4 py-3">
                {blocker ? (
                  <XCircle
                    className="w-4 h-4 mt-0.5 shrink-0"
                    style={{ color }}
                  />
                ) : (
                  <AlertTriangle
                    className="w-4 h-4 mt-0.5 shrink-0"
                    style={{ color }}
                  />
                )}
                <div className="min-w-0">
                  <div className="text-sm font-medium">{it.label}</div>
                  <div className="text-xs text-gray-400">{it.detail}</div>
                </div>
                <span
                  className="ml-auto text-[10px] font-semibold uppercase tracking-wide shrink-0"
                  style={{ color }}
                >
                  {blocker ? 'Bloqueo' : 'Verificar'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/** Which AXOS modules feed this launch, with status + a live link to fix each. */
function DependencyMatrix({
  dependencies,
}: {
  dependencies: LaunchDependency[];
}) {
  return (
    <section className="mb-2">
      <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-400 mb-3 flex items-center gap-2">
        <Network className="w-4 h-4" /> Dependencias de ingeniería
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {dependencies.map((d) => (
          <Link
            key={d.key}
            href={d.href}
            className={`${glass} group rounded-2xl p-3.5 flex items-start gap-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{d.label}</span>
                <DependencyStatusPill status={d.status} />
              </div>
              <div className="text-xs text-gray-400 mt-0.5">{d.detail}</div>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0 mt-0.5 group-hover:text-gray-500" />
          </Link>
        ))}
      </div>
    </section>
  );
}

function GateRow({
  gate,
  canWrite,
  isCurrent,
  onDecide,
}: {
  gate: NpiGate;
  canWrite: boolean;
  isCurrent: boolean;
  onDecide: (decision: GateDecision) => void;
}) {
  const decisions = gateDecisions(gate.status);
  return (
    <div
      className={`${glass} rounded-2xl p-4 flex items-center gap-3 ${
        isCurrent ? 'ring-1 ring-violet-400/40' : ''
      }`}
    >
      <div className="w-20 shrink-0">
        <div className="text-sm font-semibold">{gate.phase}</div>
        <div className="text-[11px] text-gray-400">
          {PHASE_LABEL[gate.phase] ?? gate.phase}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <GateStatusPill status={gate.status} />
        <div className="text-xs text-gray-400 mt-1 truncate">
          {gate.decidedByEmail
            ? `${gate.decidedByEmail} · ${fmtDate(gate.decidedAt)}`
            : 'Sin decidir'}
          {gate.notes ? ` · ${gate.notes}` : ''}
        </div>
      </div>
      {canWrite && decisions.length > 0 && (
        <div className="flex items-center gap-1.5 shrink-0">
          {decisions.map((dec) => {
            const m = DECISION_META[dec];
            const Icon = m.icon;
            return (
              <button
                key={dec}
                onClick={() => onDecide(dec)}
                className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg hover:opacity-90"
                style={{ color: m.color, background: `${m.color}14` }}
                title={m.label}
              >
                <Icon className="w-3.5 h-3.5" /> {m.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
