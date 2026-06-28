'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
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
  ShieldAlert,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { IconTile } from '@/components/ui/IconTile';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import {
  fmtDate,
  GateDecision,
  gateDecisions,
  NpiGate,
  NpiProject,
  NpiRisk,
  NpiRiskSeverity,
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
  openRisks,
  phaseRailForProject,
} from '../_lib/launch';
import {
  DependencyStatusPill,
  GateStatusPill,
  ProjectStatusPill,
  ReadinessPill,
  RiskSeverityPill,
  RiskStatusPill,
} from '../_lib/pills';

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
).replace(/\/$/, '');

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
  const { data: risksData, mutate: mutateRisks } = useApi<NpiRisk[]>(
    id ? `/npi/projects/${id}/risks` : null,
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

  // The backend resolves the canonical model id (soft link) on the project.
  const productModelId = project?.productModelId ?? null;
  const modelHref = productModelId
    ? `/dashboard/models/${productModelId}`
    : '/dashboard/models';

  const dependencies = useMemo(
    () =>
      deriveDependencies(project?.readiness, {
        modelResolved: !!productModelId,
        modelHref,
      }),
    [project?.readiness, productModelId, modelHref],
  );

  const risks = useMemo(
    () => (Array.isArray(risksData) ? risksData : []),
    [risksData],
  );

  const missing = useMemo(
    () => deriveMissing(project?.readiness, gates, risks),
    [project?.readiness, gates, risks],
  );

  const releasable = useMemo(
    () => canRelease(project?.readiness, gates, risks),
    [project?.readiness, gates, risks],
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
              <Boxes className="w-4 h-4" />{' '}
              {productModelId ? 'Ver modelo' : 'Maestro'}
            </Link>
          </div>
        </div>

        {/* Release banner */}
        <ReleaseBanner
          project={project}
          releasable={releasable}
          blockers={missing}
          canWrite={canWrite}
          onReleased={() => {
            mutate();
            mutateRisks();
            mutateHistory();
          }}
        />

        {/* Phase timeline */}
        <PhaseTimeline
          currentPhase={project.currentPhase}
          status={project.status}
        />

        {/* Readiness */}
        {project.readiness && <ReadinessPanel report={project.readiness} />}

        {/* What's missing to release */}
        <MissingPanel items={missing} />

        {/* Open risks */}
        <RiskPanel
          projectId={id}
          risks={risks}
          canWrite={canWrite}
          onChanged={mutateRisks}
        />

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
              className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
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

/** Top-of-dossier go/no-go banner + the explicit, audited release-to-MP action. */
function ReleaseBanner({
  project,
  releasable,
  blockers,
  canWrite,
  onReleased,
}: {
  project: NpiProject;
  releasable: boolean;
  blockers: MissingItem[];
  canWrite: boolean;
  onReleased: () => void;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const released = project.status === 'RELEASED';
  const hardBlockers = blockers.filter((b) => b.severity === 'blocker').length;

  async function release() {
    setBusy(true);
    try {
      const res = await apiFetch(
        `${API_BASE}/npi/projects/${project.id}/release`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ note: note.trim() || undefined, force: !releasable }),
        },
      );
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d?.message || 'No se pudo liberar a MP.', 'NPI');
        return;
      }
      toast.success('Launch liberado a MP.', 'NPI');
      setOpen(false);
      setNote('');
      onReleased();
    } catch {
      toast.error('Error de red.', 'NPI');
    } finally {
      setBusy(false);
    }
  }

  const accent = released ? '#10b981' : releasable ? '#10b981' : '#f59e0b';

  return (
    <div
      className={`${glass} rounded-2xl p-4 mb-6 flex items-center gap-3`}
      style={{ boxShadow: `inset 0 0 0 1px ${accent}33` }}
    >
      {released || releasable ? (
        <ShieldCheck className="w-5 h-5 shrink-0" style={{ color: accent }} />
      ) : (
        <AlertTriangle className="w-5 h-5 shrink-0" style={{ color: accent }} />
      )}
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-sm">
          {released
            ? 'Liberado a MP'
            : releasable
              ? 'Listo para liberar a MP'
              : '¿Puedo producir esto mañana? Aún no.'}
        </div>
        <div className="text-xs text-gray-400">
          {released
            ? `${project.releasedBy || 'Alguien'} · ${fmtDate(project.releasedAt)}${
                project.releaseNote ? ` · ${project.releaseNote}` : ''
              }`
            : releasable
              ? 'Readiness en verde, gates resueltos y sin riesgos altos abiertos.'
              : `${blockers.length} pendiente(s) · ${hardBlockers} bloqueo(s) duro(s) antes de liberar.`}
        </div>
      </div>
      {canWrite && !released && (
        <button
          onClick={() => {
            setNote('');
            setOpen(true);
          }}
          className="shrink-0 inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-full text-white disabled:opacity-60"
          style={{ background: releasable ? '#10b981' : '#f59e0b' }}
        >
          <Rocket className="w-4 h-4" />
          {releasable ? 'Liberar a MP' : 'Liberar con desviación'}
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className={`${glass} rounded-2xl p-5 w-full max-w-md`}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold mb-1">Liberar a producción (MP)</h3>
            <p className="text-sm text-gray-500 mb-3">
              {releasable
                ? 'El checklist está completo. Esta acción queda auditada.'
                : 'El checklist NO está completo: liberar ahora es una desviación auditada.'}
            </p>
            {!releasable && (
              <ul className="text-xs text-gray-500 mb-3 space-y-1 max-h-32 overflow-auto">
                {blockers.map((b) => (
                  <li key={b.key} className="flex items-start gap-1.5">
                    <span
                      className="mt-1 w-1.5 h-1.5 rounded-full shrink-0"
                      style={{
                        background:
                          b.severity === 'blocker' ? '#f43f5e' : '#f59e0b',
                      }}
                    />
                    {b.label}
                  </li>
                ))}
              </ul>
            )}
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                releasable
                  ? 'Nota de liberación (opcional)'
                  : 'Justificación de la desviación (recomendado)'
              }
              className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                disabled={busy}
                className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                onClick={release}
                disabled={busy}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: releasable ? '#10b981' : '#f59e0b' }}
              >
                {busy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Rocket className="w-4 h-4" />
                )}{' '}
                {releasable ? 'Liberar a MP' : 'Liberar con desviación'}
              </button>
            </div>
          </div>
        </div>
      )}
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

const RISK_INPUT =
  'w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30';

/** Advisory risk register: owner / severity / due date / status, add + resolve. */
function RiskPanel({
  projectId,
  risks,
  canWrite,
  onChanged,
}: {
  projectId: string;
  risks: NpiRisk[];
  canWrite: boolean;
  onChanged: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<{
    title: string;
    severity: NpiRiskSeverity;
    owner: string;
    dueDate: string;
    description: string;
  }>({ title: '', severity: 'MEDIUM', owner: '', dueDate: '', description: '' });

  const open = openRisks(risks);

  async function create() {
    if (!form.title.trim()) {
      toast.error('El título es obligatorio.', 'Riesgo');
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/npi/projects/${projectId}/risks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          severity: form.severity,
          owner: form.owner.trim() || undefined,
          dueDate: form.dueDate
            ? new Date(form.dueDate).toISOString()
            : undefined,
          description: form.description.trim() || undefined,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d?.message || 'No se pudo crear el riesgo.', 'Riesgo');
        return;
      }
      toast.success('Riesgo agregado.', 'Riesgo');
      setForm({
        title: '',
        severity: 'MEDIUM',
        owner: '',
        dueDate: '',
        description: '',
      });
      setShowForm(false);
      onChanged();
    } catch {
      toast.error('Error de red.', 'Riesgo');
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(r: NpiRisk, status: NpiRisk['status']) {
    try {
      const res = await apiFetch(`${API_BASE}/npi/risks/${r.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      onChanged();
    } catch {
      toast.error('No se pudo actualizar el riesgo.', 'Riesgo');
    }
  }

  async function remove(r: NpiRisk) {
    if (
      !(await confirm({
        message: `¿Eliminar el riesgo “${r.title}”?`,
        tone: 'danger',
        confirmLabel: 'Eliminar',
      }))
    )
      return;
    try {
      const res = await apiFetch(`${API_BASE}/npi/risks/${r.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error();
      toast.success('Riesgo eliminado.', 'Riesgo');
      onChanged();
    } catch {
      toast.error('No se pudo eliminar el riesgo.', 'Riesgo');
    }
  }

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-400 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" /> Riesgos
          {open.length > 0 && (
            <span className="text-[11px] font-medium text-gray-400 normal-case tracking-normal">
              · {open.length} abierto(s)
            </span>
          )}
        </h2>
        {canWrite && (
          <button
            onClick={() => setShowForm((s) => !s)}
            className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-black dark:bg-white text-white dark:text-black"
          >
            {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {showForm ? 'Cerrar' : 'Agregar'}
          </button>
        )}
      </div>

      {showForm && (
        <div className={`${glass} rounded-2xl p-4 mb-3`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block md:col-span-2">
              <span className="block text-[11px] text-gray-500 mb-1">
                Riesgo *
              </span>
              <input
                className={RISK_INPUT}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="IC U12 sin proveedor aprobado"
              />
            </label>
            <label className="block">
              <span className="block text-[11px] text-gray-500 mb-1">
                Severidad
              </span>
              <select
                className={RISK_INPUT}
                value={form.severity}
                onChange={(e) =>
                  setForm({
                    ...form,
                    severity: e.target.value as NpiRiskSeverity,
                  })
                }
              >
                <option value="HIGH">Alto</option>
                <option value="MEDIUM">Medio</option>
                <option value="LOW">Bajo</option>
              </select>
            </label>
            <label className="block">
              <span className="block text-[11px] text-gray-500 mb-1">Owner</span>
              <input
                className={RISK_INPUT}
                value={form.owner}
                onChange={(e) => setForm({ ...form, owner: e.target.value })}
                placeholder="Compras / Calidad / nombre"
              />
            </label>
            <label className="block">
              <span className="block text-[11px] text-gray-500 mb-1">
                Fecha objetivo
              </span>
              <input
                type="date"
                className={RISK_INPUT}
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="block text-[11px] text-gray-500 mb-1">
                Detalle
              </span>
              <input
                className={RISK_INPUT}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Impacto / contexto"
              />
            </label>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              onClick={create}
              disabled={busy}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white dark:text-black bg-black dark:bg-white disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}{' '}
              Registrar riesgo
            </button>
          </div>
        </div>
      )}

      {risks.length === 0 ? (
        <div
          className={`${glass} rounded-2xl p-5 flex items-center gap-3 text-sm`}
        >
          <ShieldCheck className="w-5 h-5" style={{ color: '#10b981' }} />
          <span>Sin riesgos registrados para este launch.</span>
        </div>
      ) : (
        <div
          className={`${glass} rounded-2xl divide-y divide-black/5 dark:divide-white/5`}
        >
          {risks.map((r) => (
            <div key={r.id} className="flex items-start gap-3 px-4 py-3">
              <div className="pt-0.5">
                <RiskSeverityPill severity={r.severity} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{r.title}</span>
                  <RiskStatusPill status={r.status} />
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {r.owner ? `Owner ${r.owner}` : 'Sin owner'}
                  {r.dueDate ? ` · vence ${fmtDate(r.dueDate)}` : ''}
                  {r.description ? ` · ${r.description}` : ''}
                </div>
              </div>
              {canWrite && (
                <div className="flex items-center gap-1.5 shrink-0">
                  {r.status !== 'CLOSED' ? (
                    <>
                      {r.status === 'OPEN' && (
                        <button
                          onClick={() => setStatus(r, 'MITIGATING')}
                          className="text-[11px] font-medium px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
                          style={{ color: '#f59e0b' }}
                        >
                          Mitigar
                        </button>
                      )}
                      <button
                        onClick={() => setStatus(r, 'CLOSED')}
                        className="text-[11px] font-medium px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
                        style={{ color: '#10b981' }}
                      >
                        Cerrar
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setStatus(r, 'OPEN')}
                      className="text-[11px] font-medium px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-500"
                    >
                      Reabrir
                    </button>
                  )}
                  <button
                    onClick={() => remove(r)}
                    className="p-1 rounded-lg text-gray-400 hover:text-red-500"
                    title="Eliminar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
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
