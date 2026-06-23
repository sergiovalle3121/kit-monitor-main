'use client';

/**
 * NPI (gates + readiness) folded INTO the model module. Renders inside the
 * model detail page so there is a single place — open a model, see its NPI
 * readiness and phase gates. Talks to the unified bridge endpoint
 * `/product-models/:id/npi` plus `/npi/gates/:id/decide`. Advisory only.
 */

import React, { useMemo, useState } from 'react';
import {
  Rocket,
  Loader2,
  CheckCircle2,
  XCircle,
  MinusCircle,
  ShieldCheck,
  AlertTriangle,
  History,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';
import { usePermissions } from '@/hooks/usePermissions';

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
).replace(/\/$/, '');

type GatePhase = 'QUOTE' | 'DFM' | 'EVT' | 'DVT' | 'PVT' | 'MP';
type GateStatus = 'PENDING' | 'PASSED' | 'FAILED' | 'WAIVED';
type ReadinessStatus = 'READY' | 'NOT_READY' | 'UNKNOWN';
type GateDecision = 'PASSED' | 'FAILED' | 'WAIVED';

interface NpiGate {
  id: string;
  phase: GatePhase;
  status: GateStatus;
  decidedByEmail?: string | null;
  decidedAt?: string | null;
  notes?: string | null;
}
interface ReadinessCriterion {
  key: string;
  label: string;
  status: ReadinessStatus;
  detail: string;
}
interface ReadinessReport {
  gateReady: boolean;
  readyCount: number;
  notReadyCount: number;
  unknownCount: number;
  criteria: ReadinessCriterion[];
}
interface NpiProject {
  id: string;
  currentPhase: GatePhase;
  status: 'OPEN' | 'ON_HOLD' | 'RELEASED' | 'CANCELLED';
  gates?: NpiGate[];
}
interface ReadinessSnapshot {
  id: string;
  reason: string;
  gateReady: boolean;
  readyCount: number;
  notReadyCount: number;
  unknownCount: number;
  note?: string | null;
  created_at?: string;
}
interface NpiOverview {
  project: NpiProject | null;
  readiness: ReadinessReport | null;
  history: ReadinessSnapshot[];
}

const PHASES: GatePhase[] = ['QUOTE', 'DFM', 'EVT', 'DVT', 'PVT', 'MP'];

const GATE_STATUS_META: Record<GateStatus, { label: string; color: string }> = {
  PENDING: { label: 'Pendiente', color: '#9ca3af' },
  PASSED: { label: 'Aprobado', color: '#10b981' },
  FAILED: { label: 'Rechazado', color: '#f43f5e' },
  WAIVED: { label: 'Exento', color: '#8b5cf6' },
};
const READINESS_META: Record<ReadinessStatus, { label: string; color: string }> =
  {
    READY: { label: 'Listo', color: '#10b981' },
    NOT_READY: { label: 'No listo', color: '#f43f5e' },
    UNKNOWN: { label: 'Desconocido', color: '#9ca3af' },
  };
const PHASE_LABEL: Record<GatePhase, string> = {
  QUOTE: 'Cotización',
  DFM: 'DFM',
  EVT: 'EVT',
  DVT: 'DVT',
  PVT: 'PVT',
  MP: 'Producción (MP)',
};
const DECISION_META: Record<
  GateDecision,
  { label: string; color: string; icon: typeof CheckCircle2 }
> = {
  PASSED: { label: 'Aprobar', color: '#10b981', icon: CheckCircle2 },
  FAILED: { label: 'Rechazar', color: '#f43f5e', icon: XCircle },
  WAIVED: { label: 'Eximir', color: '#8b5cf6', icon: MinusCircle },
};

function gateDecisions(status: GateStatus): GateDecision[] {
  if (status === 'PENDING') return ['PASSED', 'FAILED', 'WAIVED'];
  if (status === 'FAILED') return ['PASSED', 'WAIVED'];
  return [];
}
function fmtDate(value?: string | null): string {
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
function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
      style={{ color, background: `${color}1a` }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
function ReadinessPill({ status }: { status: ReadinessStatus }) {
  const m = READINESS_META[status] ?? { label: status, color: '#9ca3af' };
  return <Pill label={m.label} color={m.color} />;
}
function GateStatusPill({ status }: { status: GateStatus }) {
  const m = GATE_STATUS_META[status] ?? { label: status, color: '#9ca3af' };
  return <Pill label={m.label} color={m.color} />;
}

export function NpiSection({ modelId }: { modelId: string }) {
  const toast = useToast();
  const { canWrite } = usePermissions();
  const { data, isLoading, mutate } = useApi<NpiOverview>(
    modelId ? `/product-models/${modelId}/npi` : null,
  );

  const [busy, setBusy] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<{
    gateId: string;
    decision: GateDecision;
  } | null>(null);
  const [notes, setNotes] = useState('');

  const project = data?.project ?? null;
  const readiness = data?.readiness ?? null;
  const history = data?.history ?? [];
  const gates = useMemo(
    () =>
      [...(project?.gates ?? [])].sort(
        (a, b) => PHASES.indexOf(a.phase) - PHASES.indexOf(b.phase),
      ),
    [project],
  );

  async function startNpi() {
    setBusy('start');
    try {
      const res = await apiFetch(`${API_BASE}/product-models/${modelId}/npi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || 'No se pudo iniciar el NPI.', 'NPI');
        return;
      }
      toast.success('Flujo NPI iniciado.', 'NPI');
      mutate();
    } catch {
      toast.error('Error de red.', 'NPI');
    } finally {
      setBusy(null);
    }
  }

  async function decide() {
    if (!deciding) return;
    setBusy('decide');
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
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || 'No se pudo decidir el gate.', 'NPI');
        return;
      }
      toast.success('Gate actualizado.', 'NPI');
      setDeciding(null);
      setNotes('');
      mutate();
    } catch {
      toast.error('Error de red.', 'NPI');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className={`${glass} rounded-2xl p-5 mb-6`}>
      <div className="flex items-center gap-2 mb-4">
        <Rocket className="w-4 h-4 text-gray-400" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
          NPI · Readiness y gates
        </h2>
        {readiness && (
          <span className="ml-auto">
            <ReadinessPill
              status={readiness.gateReady ? 'READY' : 'NOT_READY'}
            />
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          {/* Readiness verdict */}
          {readiness ? (
            <div className="rounded-xl bg-black/[0.02] dark:bg-white/[0.03] p-4 mb-4">
              <div className="flex items-center gap-3 mb-3">
                {readiness.gateReady ? (
                  <ShieldCheck
                    className="w-5 h-5"
                    style={{ color: '#10b981' }}
                  />
                ) : (
                  <AlertTriangle
                    className="w-5 h-5"
                    style={{ color: '#f59e0b' }}
                  />
                )}
                <div className="flex-1">
                  <div className="font-semibold text-sm">
                    {readiness.gateReady
                      ? 'Listo para avanzar'
                      : 'Aún no listo'}
                  </div>
                  <div className="text-xs text-gray-400">
                    {readiness.readyCount} listo · {readiness.notReadyCount} no
                    listo · {readiness.unknownCount} desconocido
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {readiness.criteria.map((c) => (
                  <div key={c.key} className="flex items-start gap-2">
                    <ReadinessPill status={c.status} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{c.label}</div>
                      <div className="text-xs text-gray-400">{c.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 mb-4">
              Readiness no disponible para este modelo.
            </p>
          )}

          {/* Gates */}
          {!project ? (
            <div className="text-center py-4">
              <p className="text-sm text-gray-400 mb-3">
                Inicia el flujo de gates (QUOTE→MP) para orquestar la
                introducción de este modelo.
              </p>
              {canWrite && (
                <button
                  onClick={startNpi}
                  disabled={busy === 'start'}
                  className="inline-flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black text-sm font-semibold px-4 py-2.5 rounded-full disabled:opacity-60"
                >
                  {busy === 'start' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Rocket className="w-4 h-4" />
                  )}{' '}
                  Iniciar gates NPI
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {gates.map((gate) => {
                const decisions = gateDecisions(gate.status);
                const isCurrent = gate.phase === project.currentPhase;
                return (
                  <div
                    key={gate.id}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 bg-gray-50 dark:bg-white/5 ${
                      isCurrent ? 'ring-1 ring-violet-400/40' : ''
                    }`}
                  >
                    <div className="w-16 shrink-0">
                      <div className="text-sm font-semibold">{gate.phase}</div>
                      <div className="text-[10px] text-gray-400">
                        {PHASE_LABEL[gate.phase] ?? gate.phase}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <GateStatusPill status={gate.status} />
                      <div className="text-[11px] text-gray-400 mt-1 truncate">
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
                              onClick={() => {
                                setNotes('');
                                setDeciding({ gateId: gate.id, decision: dec });
                              }}
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
              })}
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div className="mt-5">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" /> Historial de readiness
              </h3>
              <div className="rounded-xl bg-gray-50 dark:bg-white/5 divide-y divide-black/5 dark:divide-white/5">
                {history.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 px-3 py-2 text-xs"
                  >
                    <ReadinessPill
                      status={s.gateReady ? 'READY' : 'NOT_READY'}
                    />
                    <span className="text-gray-400 w-28 shrink-0">
                      {fmtDate(s.created_at)}
                    </span>
                    <span className="font-medium">{s.reason}</span>
                    <span className="text-gray-400 truncate flex-1">
                      {s.readyCount}✓ · {s.notReadyCount}✗ · {s.unknownCount}?
                      {s.note ? ` · ${s.note}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Decide modal */}
      {deciding && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
          onClick={() => busy !== 'decide' && setDeciding(null)}
        >
          <div
            className={`${glass} rounded-2xl p-5 w-full max-w-md`}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold mb-1">
              {DECISION_META[deciding.decision].label} gate
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Decisión advisory: queda registrada y no activa el modelo.
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
                disabled={busy === 'decide'}
                className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                onClick={decide}
                disabled={busy === 'decide'}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: DECISION_META[deciding.decision].color }}
              >
                {busy === 'decide' ? (
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
    </section>
  );
}
