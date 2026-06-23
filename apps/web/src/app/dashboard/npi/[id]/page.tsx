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
  GateStatusPill,
  ProjectStatusPill,
  ReadinessPill,
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

  return (
    <div className="min-h-screen text-black dark:text-white font-sans pb-28">
      <main className="max-w-4xl mx-auto px-6 pt-8">
        <Link
          href="/dashboard/npi"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-black dark:hover:text-white mb-6"
        >
          <ChevronLeft className="w-4 h-4" /> NPI
        </Link>

        {/* Header */}
        <div className="flex items-start gap-4 mb-8">
          <IconTile domain="engineering" size={52} icon={Rocket} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-mono text-gray-500">
                {project.modelNumber}
              </span>
              <ProjectStatusPill status={project.status} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              {project.customer || 'Sin cliente'} · rev {project.revision}
            </h1>
            <p className="text-sm text-gray-500">
              Fase actual:{' '}
              <span className="font-medium">
                {PHASE_LABEL[project.currentPhase] ?? project.currentPhase}
              </span>
              {project.programId ? ` · Programa ${project.programId}` : ''}
            </p>
          </div>
        </div>

        {/* Readiness */}
        {project.readiness && <ReadinessPanel report={project.readiness} />}

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
          <div className={`${glass} rounded-2xl divide-y divide-black/5 dark:divide-white/5`}>
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

function ReadinessPanel({ report }: { report: ReadinessReport }) {
  const ready = report.gateReady;
  return (
    <div className={`${glass} rounded-2xl p-5`}>
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
