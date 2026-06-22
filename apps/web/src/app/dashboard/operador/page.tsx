'use client';

import React, { useCallback, useId, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  Radio,
  ScanLine,
  Factory,
  PlayCircle,
  CheckCircle2,
  Loader2,
  Lock,
  Inbox,
  Package,
  AlertTriangle,
  Bell,
  Plus,
  Minus,
  Clock,
  ShieldAlert,
  Wrench,
  Hand,
  Image as ImageIcon,
  FileText,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { useDialogA11y } from '@/hooks/useDialogA11y';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';
import { useMesSignals } from '@/hooks/useMesSignals';
import { useDashboardSession } from '@/hooks/useDashboardSession';

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
).replace(/\/$/, '');

const GREEN = '#10b981';
const AMBER = '#f59e0b';
const RED = '#ef4444';
const GRAY = '#6b7280';

// ── Types mirroring the /mes board response ────────────────────────────────
type StepStatus = 'pending' | 'in_process' | 'blocked' | 'completed';

interface ExecListItem {
  id: number;
  workOrder: string;
  model: string;
  revision: string;
  line: number | null;
  quantity: number;
  status: string;
  steps: number;
  progress: number;
  blocked: boolean;
}
interface StepView {
  id: number;
  stepId: number;
  sequence: number;
  name: string;
  stationType: string | null;
  status: StepStatus;
  unitsTarget: number;
  unitsCompleted: number;
  scrapQty: number;
  segregatedQty: number;
  upstreamAvailable: number;
  maxConfirmable: number;
  starved: boolean;
  currentOperator: string | null;
  blockReason: string | null;
}
interface Material {
  id: number;
  partNumber: string;
  description: string | null;
  unit: string;
  qtyPerUnit: number;
  plannedQty: number;
  consumedQty: number;
  remaining: number;
  availableQty: number;
  short: boolean;
}
interface VisualAid {
  kind: 'image' | 'pdf' | 'office';
  id: string;
  title?: string;
  fileUrl?: string;
  documentUrl?: string;
}
interface Incident {
  id: number;
  stepName: string | null;
  type: string;
  severity: string;
  description: string | null;
  qtyAffected: number;
  blocksFlow: boolean;
  status: string;
  disposition: string | null;
  raisedBy: string | null;
  createdAt: string;
}
interface Andon {
  id: number;
  type: string;
  status: string;
  stepName: string | null;
  note: string | null;
  raisedBy: string | null;
  createdAt: string;
}
interface Downtime {
  id: number;
  reason: string;
  partNumber: string | null;
  startedAt: string;
  endedAt: string | null;
  durationSec: number;
  materialRequestId: number | null;
}
interface Board {
  execution: {
    id: number;
    workOrder: string;
    model: string;
    revision: string;
    line: number | null;
    buildingId: string | null;
    quantity: number;
    status: string;
    startedAt: string | null;
    completedAt: string | null;
  };
  steps: StepView[];
  currentStep: StepView | null;
  currentStepDetail: {
    id: number;
    stepId: number;
    name: string;
    instructions: string | null;
    visualAid: VisualAid | null;
    materials: Material[];
    openIncidents: Incident[];
  } | null;
  andons: Andon[];
  openDowntime: Downtime[];
  assignments: { stepId: number; operatorName: string; operatorId: string | null }[];
  materialRequests: { id: number; status: string; note?: string | null }[];
  downtimeSummarySec: number;
}
function reqId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const STEP_META: Record<StepStatus, { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: GRAY },
  in_process: { label: 'En proceso', color: AMBER },
  blocked: { label: 'Bloqueado', color: RED },
  completed: { label: 'Completado', color: GREEN },
};

export default function OperadorPage() {
  const { session } = useDashboardSession();
  const operator = session?.name || session?.email || 'Operador';

  const [executionId, setExecutionId] = useState<number | null>(null);
  const [stepId, setStepId] = useState<number | null>(null);
  const [sheet, setSheet] = useState<'confirm' | 'incident' | 'andon' | null>(null);

  const {
    data: execList,
    isLoading: listLoading,
    forbidden,
    mutate: mutateList,
  } = useApi<ExecListItem[]>('/mes/executions?status=open');

  const boardPath = executionId
    ? `/mes/board?executionId=${executionId}${stepId ? `&stepId=${stepId}` : ''}`
    : null;
  const { data: board, mutate: mutateBoard } = useApi<Board>(boardPath);

  const onSignal = useCallback(() => {
    mutateList();
    if (executionId) mutateBoard();
  }, [executionId, mutateBoard, mutateList]);
  const { status: socketStatus } = useMesSignals(onSignal);

  const list = Array.isArray(execList) ? execList : [];

  return (
    <div className="min-h-screen text-black dark:text-white font-sans pb-40">
      {/* Header */}
      <div
        className={`${glass} sticky top-0 z-40 px-5 py-3 rounded-none border-x-0 border-t-0 flex items-center justify-between`}
      >
        <div className="flex items-center gap-3">
          {executionId ? (
            <button
              onClick={() => {
                setExecutionId(null);
                setStepId(null);
              }}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-black dark:hover:text-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Órdenes
            </button>
          ) : (
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-black dark:hover:text-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Dashboard
            </Link>
          )}
          <span className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <Factory className="w-5 h-5 text-amber-500" strokeWidth={1.75} /> MES · Operador
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span
            className="flex items-center gap-1.5 text-xs font-semibold"
            style={{ color: socketStatus === 'connected' ? GREEN : AMBER }}
          >
            <Radio
              className={`w-3.5 h-3.5 ${socketStatus === 'connected' ? 'animate-pulse' : ''}`}
            />
            {socketStatus === 'connected' ? 'En vivo' : 'Conectando…'}
          </span>
          <span className="hidden sm:flex items-center gap-2 text-sm">
            <span className="w-7 h-7 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 grid place-items-center text-xs font-bold">
              {operator.slice(0, 1).toUpperCase()}
            </span>
            <span className="font-medium truncate max-w-[160px]">{operator}</span>
          </span>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
        {forbidden && (
          <EmptyState
            icon={<Lock className="w-7 h-7" />}
            title="Sin acceso al backend"
            body="Verifica que el servicio de API esté conectado y que tu sesión sea válida."
          />
        )}

        {!forbidden && !executionId && (
          <Picker
            list={list}
            loading={listLoading}
            onPick={(id) => {
              setExecutionId(id);
              setStepId(null);
            }}
          />
        )}

        {!forbidden && executionId && board && (
          <BoardView
            board={board}
            operator={operator}
            position={session?.position ?? null}
            onSelectStep={(sid) => setStepId(sid)}
            onOpenSheet={setSheet}
            refresh={mutateBoard}
          />
        )}

        {!forbidden && executionId && !board && (
          <div className="flex items-center justify-center py-24 text-gray-400">
            <Loader2 className="w-7 h-7 animate-spin" />
          </div>
        )}
      </main>

      <AnimatePresence>
        {sheet && board?.currentStep && board.currentStepDetail && (
          <ActionSheet onClose={() => setSheet(null)}>
            {sheet === 'confirm' && (
              <ConfirmForm
                board={board}
                operator={operator}
                position={session?.position ?? null}
                onDone={() => {
                  setSheet(null);
                  mutateBoard();
                }}
              />
            )}
            {sheet === 'incident' && (
              <IncidentForm
                board={board}
                operator={operator}
                onDone={() => {
                  setSheet(null);
                  mutateBoard();
                }}
              />
            )}
            {sheet === 'andon' && (
              <AndonForm
                board={board}
                operator={operator}
                onDone={() => {
                  setSheet(null);
                  mutateBoard();
                }}
              />
            )}
          </ActionSheet>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Picker: scan / select an open WO ───────────────────────────────────────
function Picker({
  list,
  loading,
  onPick,
}: {
  list: ExecListItem[];
  loading: boolean;
  onPick: (id: number) => void;
}) {
  const [wo, setWo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function openByWo(e: React.FormEvent) {
    e.preventDefault();
    const value = wo.trim();
    if (!value) return;
    setBusy(true);
    setError(null);
    try {
      // Try an already-open execution first, else open a new one from the plan.
      let res = await apiFetch(
        `${API_BASE}/mes/board?workOrder=${encodeURIComponent(value)}`,
      );
      if (res.ok) {
        const b = (await res.json()) as Board;
        onPick(b.execution.id);
        return;
      }
      res = await apiFetch(`${API_BASE}/mes/executions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workOrder: value }),
      });
      if (res.ok) {
        const b = (await res.json()) as Board;
        onPick(b.execution.id);
      } else {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        setError(j.message || `No se encontró la WO ${value}.`);
      }
    } catch {
      setError('No se pudo contactar el backend.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Monta tu orden</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Escanea o escribe la orden de trabajo, o elige una de las órdenes activas en la
          línea.
        </p>
      </header>

      <form onSubmit={openByWo} className={`${glass} rounded-3xl p-4 mb-8 flex items-center gap-3`}>
        <ScanLine className="w-6 h-6 text-amber-500 flex-shrink-0" />
        <input
          value={wo}
          onChange={(e) => setWo(e.target.value)}
          autoFocus
          placeholder="Escanea / escribe la WO  (ej. 00001)"
          className="flex-1 bg-transparent outline-none text-lg font-mono tracking-wide placeholder:text-gray-400"
        />
        <button
          type="submit"
          disabled={busy || !wo.trim()}
          className="flex items-center gap-2 bg-amber-500 text-white text-sm font-bold px-5 py-2.5 rounded-full hover:bg-amber-600 active:scale-95 transition-all disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}{' '}
          Montar
        </button>
      </form>
      {error && <p className="text-sm text-rose-500 -mt-5 mb-6 px-2">{error}</p>}

      <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">
        Órdenes en la línea
      </h2>
      {loading && (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      )}
      {!loading && list.length === 0 && (
        <EmptyState
          icon={<Inbox className="w-7 h-7" />}
          title="Sin órdenes montadas"
          body="Cuando se monte una orden de trabajo en la línea aparecerá aquí. También puedes montarla escaneando su WO arriba."
        />
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map((e) => (
          <motion.button
            key={e.id}
            onClick={() => onPick(e.id)}
            whileHover={{ y: -3 }}
            className={`${glass} rounded-3xl p-5 text-left flex flex-col gap-3`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-gray-400">WO {e.workOrder}</span>
              {e.blocked ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-500">
                  Bloqueada
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600">
                  Activa
                </span>
              )}
            </div>
            <div>
              <div className="text-xl font-bold tracking-tight truncate">{e.model}</div>
              <div className="text-xs text-gray-500">
                Línea {e.line ?? '—'} · {e.quantity} u · {e.steps} estaciones
              </div>
            </div>
            <ProgressBar value={e.progress} />
          </motion.button>
        ))}
      </div>
    </div>
  );
}

// ── Board: the live station view ───────────────────────────────────────────
function BoardView({
  board,
  operator,
  position,
  onSelectStep,
  onOpenSheet,
  refresh,
}: {
  board: Board;
  operator: string;
  position: string | null;
  onSelectStep: (stepId: number) => void;
  onOpenSheet: (s: 'confirm' | 'incident' | 'andon') => void;
  refresh: () => void;
}) {
  const { execution, steps, currentStep, currentStepDetail } = board;
  const totalDone = steps.reduce((s, st) => s + st.unitsCompleted, 0);
  const totalTarget = execution.quantity * (steps.length || 1);
  const overall = totalTarget ? totalDone / totalTarget : 0;
  const blocked = currentStep?.status === 'blocked';

  return (
    <div>
      {/* WO banner */}
      <div className={`${glass} rounded-3xl p-5 mb-5`}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[11px] font-mono text-gray-400 mb-0.5">
              WO {execution.workOrder} · rev {execution.revision}
            </div>
            <div className="text-3xl font-bold tracking-tight">{execution.model}</div>
            <div className="text-sm text-gray-500">
              Línea {execution.line ?? '—'} · {execution.quantity} unidades
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold tabular-nums">{Math.round(overall * 100)}%</div>
            <div className="text-[11px] text-gray-500">avance total</div>
          </div>
        </div>
        <div className="mt-3">
          <ProgressBar value={overall} />
        </div>
      </div>

      {/* Station rail */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5 -mx-1 px-1">
        {steps.map((s) => {
          const active = currentStep?.id === s.id;
          const meta = STEP_META[s.status];
          return (
            <button
              key={s.id}
              onClick={() => onSelectStep(s.stepId)}
              className={`${glass} flex-shrink-0 rounded-2xl px-4 py-3 text-left transition-all ${
                active ? 'ring-2 ring-amber-400' : 'opacity-80 hover:opacity-100'
              }`}
              style={{ minWidth: 150 }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: s.starved ? AMBER : meta.color }}
                />
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Estación {s.sequence}
                </span>
              </div>
              <div className="font-bold text-sm truncate">{s.name}</div>
              <div className="text-[11px] text-gray-500 tabular-nums">
                {s.unitsCompleted}/{s.unitsTarget} u
                {s.scrapQty > 0 ? ` · ${s.scrapQty} scrap` : ''}
              </div>
            </button>
          );
        })}
      </div>

      {/* Status banners */}
      {blocked && (
        <Banner color={RED} icon={<ShieldAlert className="w-5 h-5" />}>
          Estación bloqueada por calidad: {currentStep?.blockReason}. Disposiciona el incidente
          para continuar.
        </Banner>
      )}
      {!blocked && currentStep?.starved && (
        <Banner color={AMBER} icon={<Clock className="w-5 h-5" />}>
          Estación en espera: la estación previa aún no libera unidades buenas (
          {currentStep.upstreamAvailable} disponibles).
        </Banner>
      )}
      {board.openDowntime.some((d) => d.reason === 'material_shortage') && (
        <Banner color={AMBER} icon={<Package className="w-5 h-5" />}>
          Faltante de material reportado a almacén · midiendo tiempo caído.
        </Banner>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Visual aid + instructions */}
        <div className={`${glass} rounded-3xl p-5`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: STEP_META[currentStep?.status ?? 'pending'].color }}
              />
              {currentStepDetail?.name ?? 'Estación'}
            </h3>
            <span className="text-[11px] text-gray-400">
              {currentStep ? `${STEP_META[currentStep.status].label}` : ''}
            </span>
          </div>
          <VisualAidView aid={currentStepDetail?.visualAid ?? null} />
          {currentStepDetail?.instructions && (
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line">
              {currentStepDetail.instructions}
            </p>
          )}
        </div>

        {/* Materials — live consumption */}
        <div className={`${glass} rounded-3xl p-5`}>
          <h3 className="font-bold mb-3 flex items-center gap-2">
            <Package className="w-4 h-4 text-gray-400" /> Materiales del paso
          </h3>
          {!currentStepDetail || currentStepDetail.materials.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">
              Esta estación no tiene materiales asignados en la ruta.
            </p>
          ) : (
            <div className="space-y-3">
              {currentStepDetail.materials.map((m) => (
                <MaterialRow key={m.id} m={m} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Open incidents (quality can disposition here) */}
      {currentStepDetail && currentStepDetail.openIncidents.length > 0 && (
        <div className="mt-5 space-y-3">
          {currentStepDetail.openIncidents.map((i) => (
            <IncidentRow key={i.id} i={i} refresh={refresh} />
          ))}
        </div>
      )}

      {/* Andon / downtime strip */}
      {(board.andons.filter((a) => a.status !== 'resolved').length > 0 ||
        board.materialRequests.length > 0) && (
        <div className="mt-5 flex flex-wrap gap-2">
          {board.andons
            .filter((a) => a.status !== 'resolved')
            .map((a) => (
              <span
                key={a.id}
                className="text-[11px] font-semibold px-3 py-1.5 rounded-full bg-rose-500/10 text-rose-600 flex items-center gap-1.5"
              >
                <Bell className="w-3.5 h-3.5" /> Andon {a.type} · {a.status}
              </span>
            ))}
          {board.materialRequests.map((r) => (
            <span
              key={r.id}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-700 flex items-center gap-1.5"
            >
              <Package className="w-3.5 h-3.5" /> Surtido #{r.id} · {r.status}
            </span>
          ))}
        </div>
      )}

      {/* Action bar */}
      <div
        className={`${glass} fixed bottom-4 left-1/2 -translate-x-1/2 z-30 px-3 py-3 rounded-[2rem] shadow-2xl flex items-center gap-2 w-[min(720px,92vw)]`}
      >
        <button
          onClick={() => onOpenSheet('confirm')}
          disabled={blocked || currentStep?.status === 'completed'}
          className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 text-white text-base font-bold px-5 py-4 rounded-3xl hover:bg-emerald-600 active:scale-[0.98] transition-all disabled:opacity-40"
        >
          <CheckCircle2 className="w-5 h-5" /> Confirmar avance
        </button>
        <button
          onClick={() => onOpenSheet('incident')}
          className="flex items-center justify-center gap-2 bg-rose-500/10 text-rose-600 text-sm font-bold px-4 py-4 rounded-3xl hover:bg-rose-500/20 active:scale-95 transition-all"
        >
          <AlertTriangle className="w-5 h-5" /> <span className="hidden sm:inline">Incidente</span>
        </button>
        <button
          onClick={() => onOpenSheet('andon')}
          className="flex items-center justify-center gap-2 bg-amber-500/10 text-amber-700 text-sm font-bold px-4 py-4 rounded-3xl hover:bg-amber-500/20 active:scale-95 transition-all"
        >
          <Bell className="w-5 h-5" /> <span className="hidden sm:inline">Andon</span>
        </button>
      </div>
      <input type="hidden" value={`${operator}/${position ?? ''}`} readOnly />
    </div>
  );
}

function VisualAidView({ aid }: { aid: VisualAid | null }) {
  if (!aid) {
    return (
      <div className="aspect-video rounded-2xl bg-gray-100 dark:bg-white/5 grid place-items-center text-gray-400 text-sm">
        <div className="flex flex-col items-center gap-2">
          <ImageIcon className="w-7 h-7" />
          Sin ayuda visual ligada a este paso
        </div>
      </div>
    );
  }
  if (aid.kind === 'image' && aid.fileUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`${API_BASE}${aid.fileUrl}`}
        alt={aid.title || 'Ayuda visual'}
        className="w-full max-h-[360px] object-contain rounded-2xl bg-gray-50 dark:bg-white/5"
      />
    );
  }
  const href =
    aid.kind === 'pdf' && aid.fileUrl
      ? `${API_BASE}${aid.fileUrl}`
      : aid.documentUrl
        ? `${API_BASE}${aid.documentUrl}`
        : '#';
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="aspect-video rounded-2xl bg-gray-100 dark:bg-white/5 grid place-items-center text-amber-600 text-sm font-semibold hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
    >
      <div className="flex flex-col items-center gap-2">
        <FileText className="w-7 h-7" />
        Abrir {aid.kind === 'pdf' ? 'PDF' : 'presentación'}
      </div>
    </a>
  );
}

function MaterialRow({ m }: { m: Material }) {
  const pct = m.plannedQty > 0 ? Math.min(1, m.consumedQty / m.plannedQty) : 0;
  const color = m.short ? RED : m.availableQty <= m.plannedQty * 0.15 ? AMBER : GREEN;
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="font-mono font-semibold">{m.partNumber}</span>
        <span className="tabular-nums text-gray-500">
          {m.consumedQty}/{m.plannedQty} {m.unit}
          {m.short && <span className="ml-2 text-rose-500 font-bold">FALTA</span>}
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct * 100}%`, backgroundColor: color }}
        />
      </div>
      {m.description && <div className="text-[11px] text-gray-400 mt-0.5">{m.description}</div>}
    </div>
  );
}

function IncidentRow({ i, refresh }: { i: Incident; refresh: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();
  async function disposition(d: 'rework' | 'scrap' | 'use_as_is') {
    setBusy(d);
    try {
      const res = await apiFetch(`${API_BASE}/mes/incidents/${i.id}/disposition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disposition: d }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        toast.error(typeof j.message === 'string' ? j.message : 'No se pudo registrar la disposición.', 'Calidad');
        return;
      }
      refresh();
    } catch {
      toast.error('No se pudo contactar el backend.', 'Calidad');
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className={`${glass} rounded-2xl p-4`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-500">
          {i.severity}
        </span>
        <span className="font-bold">{i.type}</span>
        {i.blocksFlow && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500 text-white">
            BLOQUEA
          </span>
        )}
        <span className="ml-auto text-[11px] text-gray-400">
          {i.qtyAffected} u segregadas · {i.raisedBy}
        </span>
      </div>
      <div className="flex gap-2">
        {(['rework', 'scrap', 'use_as_is'] as const).map((d) => (
          <button
            key={d}
            onClick={() => disposition(d)}
            disabled={!!busy}
            className="flex-1 text-xs font-semibold px-3 py-2 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 active:scale-95 transition-all disabled:opacity-50"
          >
            {busy === d ? (
              <Loader2 className="w-4 h-4 animate-spin mx-auto" />
            ) : d === 'rework' ? (
              'Retrabajo'
            ) : d === 'scrap' ? (
              'Scrap'
            ) : (
              'Usar como está'
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Sheets ─────────────────────────────────────────────────────────────────
function ActionSheet({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  const panelRef = useDialogA11y<HTMLDivElement>(onClose);
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Acciones"
        tabIndex={-1}
        className={`${glass} w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6 max-h-[90vh] overflow-y-auto`}
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

function Stepper({
  label,
  value,
  setValue,
  min = 0,
  max,
}: {
  label: string;
  value: number;
  setValue: (n: number) => void;
  min?: number;
  max?: number;
}) {
  const clamp = (n: number) => Math.max(min, max !== undefined ? Math.min(max, n) : n);
  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </label>
      <div className="flex items-center gap-3 mt-1">
        <button
          onClick={() => setValue(clamp(value - 1))}
          className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-white/10 grid place-items-center active:scale-90 transition-transform"
        >
          <Minus className="w-5 h-5" />
        </button>
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(clamp(Number(e.target.value) || 0))}
          className="flex-1 text-center text-3xl font-bold tabular-nums bg-transparent outline-none w-full"
        />
        <button
          onClick={() => setValue(clamp(value + 1))}
          className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-white/10 grid place-items-center active:scale-90 transition-transform"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

function ConfirmForm({
  board,
  operator,
  position,
  onDone,
}: {
  board: Board;
  operator: string;
  position: string | null;
  onDone: () => void;
}) {
  const step = board.currentStep!;
  const max = Math.max(0, Math.floor(step.maxConfirmable));
  const [qty, setQty] = useState(Math.min(max || 1, 1));
  const [scrap, setScrap] = useState(0);
  const [serial, setSerial] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch(
        `${API_BASE}/mes/executions/${board.execution.id}/steps/${step.stepId}/confirm`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quantity: qty,
            scrap,
            serial: serial.trim() || undefined,
            operator,
            operatorPosition: position || undefined,
            clientRequestId: reqId(),
          }),
        },
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        setError(typeof j.message === 'string' ? j.message : 'No se pudo confirmar.');
        return;
      }
      onDone();
    } catch {
      setError('No se pudo contactar el backend.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <SheetHeader title="Confirmar avance" subtitle={step.name} />
      <div className="space-y-5">
        <Stepper label="Unidades buenas" value={qty} setValue={setQty} min={0} max={max} />
        <Stepper label="Scrap (merma)" value={scrap} setValue={setScrap} min={0} />
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
            <ScanLine className="w-3.5 h-3.5" /> Serie (opcional · escanea)
          </label>
          <input
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
            placeholder="SN-…"
            className="mt-1 w-full bg-gray-100 dark:bg-white/5 rounded-2xl px-4 py-3 font-mono outline-none"
          />
        </div>
        <p className="text-[11px] text-gray-400">
          Disponible de la estación previa: {step.maxConfirmable} u. Al confirmar se descuenta el
          material del paso (backflush).
        </p>
        {error && <p className="text-sm text-rose-500">{error}</p>}
        <button
          onClick={submit}
          disabled={busy || qty + scrap <= 0}
          className="w-full bg-emerald-500 text-white text-base font-bold py-4 rounded-2xl hover:bg-emerald-600 active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
          Confirmar {qty} u{scrap > 0 ? ` · ${scrap} scrap` : ''}
        </button>
      </div>
    </div>
  );
}

const INCIDENT_TYPES = ['Defecto visual', 'Soldadura fría', 'Componente dañado', 'Falta material', 'Otro'];
const SEVERITIES: { id: string; label: string; color: string }[] = [
  { id: 'low', label: 'Baja', color: GRAY },
  { id: 'medium', label: 'Media', color: AMBER },
  { id: 'high', label: 'Alta', color: '#fb7185' },
  { id: 'critical', label: 'Crítica', color: RED },
];

function IncidentForm({
  board,
  operator,
  onDone,
}: {
  board: Board;
  operator: string;
  onDone: () => void;
}) {
  const step = board.currentStep!;
  const [type, setType] = useState(INCIDENT_TYPES[0]);
  const [severity, setSeverity] = useState('medium');
  const [qty, setQty] = useState(1);
  const [blocks, setBlocks] = useState(false);
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function submit() {
    setBusy(true);
    try {
      const res = await apiFetch(
        `${API_BASE}/mes/executions/${board.execution.id}/steps/${step.stepId}/incidents`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type,
            severity,
            qtyAffected: qty,
            blocksFlow: blocks,
            description: desc.trim() || undefined,
            operator,
          }),
        },
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        toast.error(typeof j.message === 'string' ? j.message : 'No se pudo reportar el incidente.', 'Calidad');
        return;
      }
      onDone();
    } catch {
      toast.error('No se pudo contactar el backend.', 'Calidad');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <SheetHeader title="Reportar incidente de calidad" subtitle={step.name} />
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {INCIDENT_TYPES.map((t) => (
            <Chip key={t} active={type === t} onClick={() => setType(t)} label={t} />
          ))}
        </div>
        <div className="flex gap-2">
          {SEVERITIES.map((s) => (
            <button
              key={s.id}
              onClick={() => setSeverity(s.id)}
              className={`flex-1 text-xs font-bold py-2 rounded-xl transition-all ${
                severity === s.id ? 'text-white' : 'text-gray-500 bg-gray-100 dark:bg-white/5'
              }`}
              style={severity === s.id ? { backgroundColor: s.color } : undefined}
            >
              {s.label}
            </button>
          ))}
        </div>
        <Stepper label="Unidades afectadas (se segregan)" value={qty} setValue={setQty} min={0} />
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Descripción (opcional)"
          rows={2}
          className="w-full bg-gray-100 dark:bg-white/5 rounded-2xl px-4 py-3 outline-none text-sm"
        />
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={blocks}
            onChange={(e) => setBlocks(e.target.checked)}
            className="w-5 h-5 accent-rose-500"
          />
          <span className="text-sm font-medium">
            Bloquear la estación (retención por calidad)
          </span>
        </label>
        <button
          onClick={submit}
          disabled={busy || !type}
          className="w-full bg-rose-500 text-white text-base font-bold py-4 rounded-2xl hover:bg-rose-600 active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <AlertTriangle className="w-5 h-5" />}
          Reportar incidente
        </button>
      </div>
    </div>
  );
}

const ANDON_TYPES: { id: 'material' | 'quality' | 'maintenance' | 'stop'; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'material', label: 'Materiales', icon: <Package className="w-6 h-6" />, color: AMBER },
  { id: 'quality', label: 'Calidad', icon: <ShieldAlert className="w-6 h-6" />, color: '#fb7185' },
  { id: 'maintenance', label: 'Mantto', icon: <Wrench className="w-6 h-6" />, color: '#60a5fa' },
  { id: 'stop', label: 'Paro de línea', icon: <Hand className="w-6 h-6" />, color: RED },
];

function AndonForm({
  board,
  operator,
  onDone,
}: {
  board: Board;
  operator: string;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();
  async function call(type: string) {
    setBusy(type);
    try {
      const res = await apiFetch(`${API_BASE}/mes/executions/${board.execution.id}/andon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          stepId: board.currentStep?.stepId,
          raisedBy: operator,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        toast.error(typeof j.message === 'string' ? j.message : 'No se pudo levantar el andon.', 'Andon');
        return;
      }
      onDone();
    } catch {
      toast.error('No se pudo contactar el backend.', 'Andon');
    } finally {
      setBusy(null);
    }
  }
  return (
    <div>
      <SheetHeader title="Andon" subtitle="Llama a soporte a tu estación" />
      <div className="grid grid-cols-2 gap-3">
        {ANDON_TYPES.map((a) => (
          <button
            key={a.id}
            onClick={() => call(a.id)}
            disabled={!!busy}
            className={`${glass} rounded-3xl p-5 flex flex-col items-center gap-2 active:scale-95 transition-all disabled:opacity-50`}
            style={{ color: a.color }}
          >
            {busy === a.id ? <Loader2 className="w-6 h-6 animate-spin" /> : a.icon}
            <span className="font-bold text-sm">{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Small shared bits ──────────────────────────────────────────────────────
function SheetHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h3 className="text-xl font-bold tracking-tight">{title}</h3>
      {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
    </div>
  );
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs font-semibold px-3 py-2 rounded-full transition-all ${
        active
          ? 'bg-black text-white dark:bg-white dark:text-black'
          : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300'
      }`}
    >
      {label}
    </button>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2.5 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
      <div
        className="h-full rounded-full bg-emerald-500 transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
      />
    </div>
  );
}

function Banner({
  color,
  icon,
  children,
}: {
  color: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl p-3.5 mb-4 flex items-center gap-3 text-sm font-medium"
      style={{ backgroundColor: `${color}1a`, color }}
    >
      {icon}
      <span>{children}</span>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col items-center text-center py-20 px-6">
      <div className="p-4 rounded-2xl bg-gray-100 dark:bg-white/5 text-gray-400 mb-4">{icon}</div>
      <h3 className="font-bold text-lg mb-1">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">{body}</p>
    </div>
  );
}
