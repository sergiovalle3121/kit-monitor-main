"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ScanLine,
  PlayCircle,
  CheckCircle2,
  Loader2,
  Lock,
  Inbox,
  Package,
  AlertTriangle,
  Plus,
  Minus,
  Clock,
  ShieldAlert,
  Image as ImageIcon,
} from "lucide-react";
import { glass } from "@/lib/glass";
import { useApi } from "@/hooks/useApi";
import { useDialogA11y } from "@/hooks/useDialogA11y";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/contexts/ToastContext";
import { useMesSignals } from "@/hooks/useMesSignals";
import { useDashboardSession } from "@/hooks/useDashboardSession";
import {
  buildOperatorActionSignature,
  buildOperatorConfirmationSummary,
  classifyScan,
  deriveMaterialRequestReadiness,
  type OperatorConfirmationSummary,
  type OfflineAction,
  type ScanResult,
  type ScanState,
} from "./operator-terminal.utils";
import {
  ANDON_TYPES,
  DOWNTIME_REASON_OPTIONS,
  type DowntimeReasonCode,
} from "./andon-types";
import { IncidentDispositionPanel } from "./incident-disposition-panel";
import { IndustrialTopBar } from "./industrial-top-bar";
import { MaterialConsumptionPanel } from "./material-consumption-panel";
import { OperatorActionBar } from "./operator-action-bar";
import { ExecutionCommandCenter } from "./execution-command-center";
import { ProductionPanel } from "./production-panel";
import { QualitySidePanel } from "./quality-side-panel";
import { ScannerPanel } from "./scanner-panel";
import { StationAlertStrip } from "./station-alert-strip";
import { StationRail, stationStatusMeta } from "./station-rail";
import { WorkInstructionPanel, type VisualAid } from "./work-instruction-panel";
import { WorkOrderSummaryCard } from "./work-order-summary-card";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
).replace(/\/$/, "");

const AMBER = "#f59e0b";
const RED = "#ef4444";
const GRAY = "#6b7280";
type OperatorSheet = "confirm" | "incident" | "andon" | "material";

// ── Types mirroring the /mes board response ────────────────────────────────
type StepStatus = "pending" | "in_process" | "blocked" | "completed";

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
    kitId: number | null;
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
  assignments: {
    stepId: number;
    operatorName: string;
    operatorId: string | null;
  }[];
  materialRequests: { id: number; status: string; note?: string | null }[];
  downtimeSummarySec: number;
}
function reqId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}



function useOperatorClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function shiftLabel(now: Date) {
  const hour = now.getHours();
  if (hour >= 6 && hour < 14) return "Turno A · 06:00-14:00";
  if (hour >= 14 && hour < 22) return "Turno B · 14:00-22:00";
  return "Turno C · 22:00-06:00";
}

function formatClock(now: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);
}

const SCANNER_BUFFER_TIMEOUT_MS = 75;
const SCAN_HISTORY_LIMIT = 6;

function scannerTone(ok: boolean) {
  if (typeof window === "undefined") return;
  try {
    const AudioContextCtor = window.AudioContext;
    if (!AudioContextCtor) return;
    const ctx = new AudioContextCtor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = ok ? 880 : 220;
    gain.gain.value = 0.04;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (ok ? 0.07 : 0.16));
  } catch {
    // Audio feedback is best-effort; scanner validation still works without it.
  }
}

function useIndustrialScanner(onScan: (scan: ScanResult) => void) {
  const [scannerState, setScannerState] = useState<ScanState>("idle");
  const [lastScan, setLastScan] = useState<ScanResult | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanResult[]>([]);
  const bufferRef = useRef("");
  const timerRef = useRef<number | null>(null);
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const commitScan = useCallback((raw: string) => {
    const result: ScanResult = {
      ...classifyScan(raw),
      at: new Date().toISOString(),
    };
    setLastScan(result);
    setScannerState(result.valid ? "valid" : "invalid");
    setScanHistory((prev) => [result, ...prev].slice(0, SCAN_HISTORY_LIMIT));
    scannerTone(result.valid);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(result.valid ? 25 : [40, 40, 80]);
    }
    if (result.valid) onScanRef.current(result);
    window.setTimeout(() => setScannerState("idle"), 900);
  }, []);

  useEffect(() => {
    function flushBuffer() {
      const value = bufferRef.current;
      bufferRef.current = "";
      if (value.length >= 3) commitScan(value);
      else setScannerState("idle");
    }

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isEditable =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      if (isEditable && !event.ctrlKey && !event.metaKey) return;
      if (event.key === "Enter") {
        if (bufferRef.current) {
          event.preventDefault();
          flushBuffer();
        }
        return;
      }
      if (
        event.key.length !== 1 ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      )
        return;
      bufferRef.current += event.key;
      setScannerState("reading");
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(
        flushBuffer,
        SCANNER_BUFFER_TIMEOUT_MS,
      );
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [commitScan]);

  return { scannerState, lastScan, scanHistory, commitScan };
}

function useOperatorShortcuts({
  enabled,
  onConfirm,
  onIncident,
  onAndon,
  onMaterial,
  onRefresh,
  onCancel,
}: {
  enabled: boolean;
  onConfirm: () => void;
  onIncident: () => void;
  onAndon: () => void;
  onMaterial: () => void;
  onRefresh: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!enabled && !["F1", "F5", "Escape"].includes(event.key)) return;
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      if (isTyping) return;
      const handled = [
        "F1",
        "F2",
        "F3",
        "F4",
        "F5",
        "F6",
        "F7",
        "Escape",
        "Enter",
      ].includes(event.key);
      if (!handled) return;
      event.preventDefault();
      if (event.key === "F2") onIncident();
      if (event.key === "F3") onConfirm();
      if (event.key === "F4") onMaterial();
      if (event.key === "F5") onRefresh();
      if (event.key === "F6") onAndon();
      if (event.key === "F7") onIncident();
      if (event.key === "Escape") onCancel();
      if (event.key === "Enter") onConfirm();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    enabled,
    onAndon,
    onCancel,
    onConfirm,
    onIncident,
    onMaterial,
    onRefresh,
  ]);
}

function useOfflineActionQueue() {
  const [queue, setQueue] = useState<OfflineAction[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem("axos_operator_offline_queue");
      return raw ? (JSON.parse(raw) as OfflineAction[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "axos_operator_offline_queue",
        JSON.stringify(queue),
      );
    } catch {
      // Best-effort local queue persistence.
    }
  }, [queue]);

  const enqueue = useCallback(
    (action: Omit<OfflineAction, "id" | "createdAt" | "attempts">) => {
      setQueue((prev) =>
        [
          {
            ...action,
            id: reqId(),
            createdAt: new Date().toISOString(),
            attempts: 0,
          },
          ...prev,
        ].slice(0, 50),
      );
    },
    [],
  );

  const clear = useCallback(() => setQueue([]), []);
  const markAttempt = useCallback((id: string) => {
    setQueue((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, attempts: item.attempts + 1 } : item,
      ),
    );
  }, []);

  return { queue, enqueue, clear, markAttempt };
}

export default function OperadorPage() {
  const { session } = useDashboardSession();
  const operator = session?.name || session?.email || "Operador";
  const now = useOperatorClock();
  const [gloveMode, setGloveMode] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem("axos_operator_glove") !== "0";
  });
  const offlineQueue = useOfflineActionQueue();

  const [executionId, setExecutionId] = useState<number | null>(null);
  const [stepId, setStepId] = useState<number | null>(null);
  const [sheet, setSheet] = useState<OperatorSheet | null>(null);

  const {
    data: execList,
    isLoading: listLoading,
    forbidden,
    mutate: mutateList,
  } = useApi<ExecListItem[]>("/mes/executions?status=open");

  const boardPath = executionId
    ? `/mes/board?executionId=${executionId}${stepId ? `&stepId=${stepId}` : ""}`
    : null;
  const { data: board, mutate: mutateBoard } = useApi<Board>(boardPath);

  const onSignal = useCallback(() => {
    mutateList();
    if (executionId) mutateBoard();
  }, [executionId, mutateBoard, mutateList]);
  const { status: socketStatus } = useMesSignals(onSignal);

  const list = Array.isArray(execList) ? execList : [];

  useEffect(() => {
    window.localStorage.setItem("axos_operator_glove", gloveMode ? "1" : "0");
  }, [gloveMode]);

  useOperatorShortcuts({
    enabled: !!executionId,
    onConfirm: () => setSheet("confirm"),
    onIncident: () => setSheet("incident"),
    onAndon: () => setSheet("andon"),
    onMaterial: () => setSheet("material"),
    onRefresh: () => {
      mutateList();
      if (executionId) mutateBoard();
    },
    onCancel: () => setSheet(null),
  });

  return (
    <div
      className={`min-h-screen font-sans pb-44 bg-background text-foreground ${gloveMode ? "[&_*]:touch-manipulation" : ""}`}
    >
      <IndustrialTopBar
        execution={board?.execution ?? null}
        currentStep={board?.currentStep ?? null}
        operator={operator}
        shift={shiftLabel(now)}
        clock={formatClock(now)}
        socketStatus={socketStatus}
        alerts={
          (board?.andons.filter((a) => a.status !== "resolved").length ?? 0) +
          (board?.currentStepDetail?.openIncidents.length ?? 0)
        }
        gloveMode={gloveMode}
        onToggleGlove={() => setGloveMode((v) => !v)}
        onBack={
          executionId
            ? () => {
                setExecutionId(null);
                setStepId(null);
              }
            : null
        }
      />

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
            gloveMode={gloveMode}
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
            offlineQueue={offlineQueue.queue}
            clearOfflineQueue={offlineQueue.clear}
            markOfflineAttempt={offlineQueue.markAttempt}
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
            {sheet === "confirm" && (
              <ConfirmForm
                board={board}
                operator={operator}
                position={session?.position ?? null}
                onQueueAction={offlineQueue.enqueue}
                onCancel={() => setSheet(null)}
                onDone={() => {
                  setSheet(null);
                  mutateBoard();
                }}
              />
            )}
            {sheet === "incident" && (
              <IncidentForm
                board={board}
                operator={operator}
                onQueueAction={offlineQueue.enqueue}
                onDone={() => {
                  setSheet(null);
                  mutateBoard();
                }}
              />
            )}
            {sheet === "andon" && (
              <AndonForm
                board={board}
                operator={operator}
                onQueueAction={offlineQueue.enqueue}
                onDone={() => {
                  setSheet(null);
                  mutateBoard();
                }}
              />
            )}
            {sheet === "material" && (
              <MaterialRequestForm
                board={board}
                operator={operator}
                onQueueAction={offlineQueue.enqueue}
                onCancel={() => setSheet(null)}
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
  gloveMode,
  onPick,
}: {
  list: ExecListItem[];
  loading: boolean;
  gloveMode: boolean;
  onPick: (id: number) => void;
}) {
  const [wo, setWo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const openByValue = useCallback(
    async (rawValue: string) => {
      const classified = classifyScan(rawValue);
      const value =
        classified.kind === "wo" ? classified.normalized : rawValue.trim();
      if (!value) return;
      setWo(value);
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
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workOrder: value }),
        });
        if (res.ok) {
          const b = (await res.json()) as Board;
          onPick(b.execution.id);
        } else {
          const j = (await res.json().catch(() => ({}))) as {
            message?: string;
          };
          setError(j.message || `No se encontró la WO ${value}.`);
        }
      } catch {
        setError("No se pudo contactar el backend.");
      } finally {
        setBusy(false);
      }
    },
    [onPick],
  );

  const scanner = useIndustrialScanner((scan) => {
    if (scan.kind === "wo") void openByValue(scan.normalized);
    else setError(`${scan.message} Escanea una WO para montar la orden.`);
  });

  async function openByWo(e: React.FormEvent) {
    e.preventDefault();
    await openByValue(wo);
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Monta tu orden</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Escanea o escribe la orden de trabajo, o elige una de las órdenes
          activas en la línea.
        </p>
      </header>

      <ScannerPanel
        state={scanner.scannerState}
        lastScan={scanner.lastScan}
        history={scanner.scanHistory}
        expected="wo"
      />

      <form
        onSubmit={openByWo}
        className={`${glass} rounded-3xl p-4 mb-8 flex items-center gap-3 ${gloveMode ? "min-h-24" : ""}`}
      >
        <ScanLine className="w-6 h-6 text-amber-500 flex-shrink-0" />
        <input
          value={wo}
          onChange={(e) => setWo(e.target.value)}
          autoFocus
          placeholder="Escanea / escribe la WO  (ej. 00001)"
          className="flex-1 bg-transparent outline-none text-2xl font-mono tracking-wide placeholder:text-gray-400"
        />
        <button
          type="submit"
          disabled={busy || !wo.trim()}
          className="flex items-center gap-2 bg-amber-500 text-white text-base font-bold px-7 py-5 rounded-full hover:bg-amber-600 active:scale-95 transition-all disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <PlayCircle className="w-4 h-4" />
          )}{" "}
          Montar
        </button>
      </form>
      {error && (
        <p className="text-sm text-rose-500 -mt-5 mb-6 px-2">{error}</p>
      )}

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
            className={`${glass} rounded-3xl p-6 text-left flex flex-col gap-3 min-h-44`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-gray-400">
                WO {e.workOrder}
              </span>
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
              <div className="text-xl font-bold tracking-tight truncate">
                {e.model}
              </div>
              <div className="text-xs text-gray-500">
                Línea {e.line ?? "—"} · {e.quantity} u · {e.steps} estaciones
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
  offlineQueue,
  clearOfflineQueue,
  markOfflineAttempt,
}: {
  board: Board;
  operator: string;
  position: string | null;
  onSelectStep: (stepId: number) => void;
  onOpenSheet: (s: OperatorSheet) => void;
  refresh: () => void;
  offlineQueue: OfflineAction[];
  clearOfflineQueue: () => void;
  markOfflineAttempt: (id: string) => void;
}) {
  const { execution, steps, currentStep, currentStepDetail } = board;
  const totalDone = steps.reduce((s, st) => s + st.unitsCompleted, 0);
  const totalTarget = execution.quantity * (steps.length || 1);
  const overall = totalTarget ? totalDone / totalTarget : 0;
  const blocked = currentStep?.status === "blocked";

  return (
    <div>
      <WorkOrderSummaryCard execution={execution} overall={overall} />

      <ProductionPanel board={board} overall={overall} />

      <StationRail
        steps={steps}
        currentStepId={currentStep?.id ?? null}
        onSelectStep={onSelectStep}
      />

      {/* Status banners */}
      {blocked && (
        <Banner color={RED} icon={<ShieldAlert className="w-5 h-5" />}>
          Estación bloqueada por calidad: {currentStep?.blockReason}.
          Disposiciona el incidente para continuar.
        </Banner>
      )}
      {!blocked && currentStep?.starved && (
        <Banner color={AMBER} icon={<Clock className="w-5 h-5" />}>
          Estación en espera: la estación previa aún no libera unidades buenas (
          {currentStep.upstreamAvailable} disponibles).
        </Banner>
      )}
      {board.openDowntime.some((d) => d.reason === "material_shortage") && (
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
                style={{
                  backgroundColor:
                    stationStatusMeta(currentStep?.status ?? "pending").color,
                }}
              />
              {currentStepDetail?.name ?? "Estación"}
            </h3>
            <span className="text-[11px] text-gray-400">
              {currentStep ? stationStatusMeta(currentStep.status).label : ""}
            </span>
          </div>
          <WorkInstructionPanel
            aid={currentStepDetail?.visualAid ?? null}
            instructions={currentStepDetail?.instructions ?? null}
            stepName={currentStepDetail?.name ?? "Estación"}
            apiBase={API_BASE}
          />
        </div>

        <MaterialConsumptionPanel materials={currentStepDetail?.materials ?? []} />
      </div>

      <QualitySidePanel
        board={board}
        onOpenIncident={() => onOpenSheet("incident")}
      />

      <ExecutionCommandCenter
        board={board}
        refresh={refresh}
        onOpenSheet={onOpenSheet}
        offlineQueue={offlineQueue}
        clearOfflineQueue={clearOfflineQueue}
        markOfflineAttempt={markOfflineAttempt}
      />

      <IncidentDispositionPanel
        incidents={currentStepDetail?.openIncidents ?? []}
        apiBase={API_BASE}
        refresh={refresh}
      />

      <StationAlertStrip
        andons={board.andons}
        materialRequests={board.materialRequests}
      />

      <OperatorActionBar
        blocked={blocked}
        currentStepStatus={currentStep?.status ?? null}
        onOpenSheet={onOpenSheet}
      />
      <input type="hidden" value={`${operator}/${position ?? ""}`} readOnly />
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
  const clamp = (n: number) =>
    Math.max(min, max !== undefined ? Math.min(max, n) : n);
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
  onQueueAction,
  onCancel,
  onDone,
}: {
  board: Board;
  operator: string;
  position: string | null;
  onQueueAction: (
    action: Omit<OfflineAction, "id" | "createdAt" | "attempts">,
  ) => void;
  onCancel: () => void;
  onDone: () => void;
}) {
  const step = board.currentStep!;
  const max = Math.max(0, Math.floor(step.maxConfirmable));
  const [qty, setQty] = useState(Math.min(max || 1, 1));
  const [scrap, setScrap] = useState(0);
  const [serial, setSerial] = useState("");
  const [armedSignature, setArmedSignature] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmationSignature = buildOperatorActionSignature({
    action: "confirm-advance",
    workOrder: board.execution.workOrder,
    stepId: step.stepId,
    quantity: qty,
    scrap,
    serial,
  });
  const armed = armedSignature === confirmationSignature;
  const summary = buildOperatorConfirmationSummary({
    action: "confirm-advance",
    workOrder: board.execution.workOrder,
    stepName: step.name,
    quantity: qty,
    scrap,
    operator,
  });

  const scanner = useIndustrialScanner((scan) => {
    if (["serial", "qr", "datamatrix", "code128"].includes(scan.kind)) {
      setSerial(scan.normalized);
      setArmedSignature(null);
      setError(null);
    } else {
      setError(`${scan.message} Se esperaba serial, QR, DataMatrix o Code128.`);
    }
  });

  function updateQty(nextQty: number) {
    setQty(nextQty);
    setArmedSignature(null);
  }

  function updateScrap(nextScrap: number) {
    setScrap(nextScrap);
    setArmedSignature(null);
  }

  function updateSerial(nextSerial: string) {
    setSerial(nextSerial);
    setArmedSignature(null);
  }

  async function submit() {
    if (!armed) {
      setError(null);
      setArmedSignature(confirmationSignature);
      return;
    }

    const payload = {
      quantity: qty,
      scrap,
      serial: serial.trim() || undefined,
      operator,
      operatorPosition: position || undefined,
      clientRequestId: reqId(),
    };
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch(
        `${API_BASE}/mes/executions/${board.execution.id}/steps/${step.stepId}/confirm`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        setError(
          typeof j.message === "string" ? j.message : "No se pudo confirmar.",
        );
        return;
      }
      onDone();
    } catch {
      onQueueAction({
        type: "confirm",
        label: `Confirmar ${qty}u · ${board.execution.workOrder}`,
        payload,
      });
      setError("Sin conexión: acción guardada en cola local.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <SheetHeader title="Confirmar avance" subtitle={step.name} />
      <div className="space-y-5">
        <Stepper
          label="Unidades buenas"
          value={qty}
          setValue={updateQty}
          min={0}
          max={max}
        />
        <Stepper
          label="Scrap (merma)"
          value={scrap}
          setValue={updateScrap}
          min={0}
        />
        <ScannerPanel
          state={scanner.scannerState}
          lastScan={scanner.lastScan}
          history={scanner.scanHistory}
          expected="serial"
          compact
        />
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
            <ScanLine className="w-3.5 h-3.5" /> Serie (opcional · escanea)
          </label>
          <input
            value={serial}
            onChange={(e) => updateSerial(e.target.value)}
            placeholder="SN-…"
            className="mt-1 w-full bg-gray-100 dark:bg-white/5 rounded-2xl px-4 py-3 font-mono outline-none"
          />
        </div>
        <p className="text-[11px] text-gray-400">
          Disponible de la estación previa: {step.maxConfirmable} u. Al
          confirmar se descuenta el material del paso (backflush).
        </p>
        <ConfirmationReview summary={summary} armed={armed} />
        {error && <p className="text-sm text-rose-500">{error}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-[0.8fr_1.2fr] gap-3">
          <button
            onClick={onCancel}
            disabled={busy}
            className="w-full bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-200 text-base font-bold py-4 rounded-2xl hover:bg-gray-200 dark:hover:bg-white/15 active:scale-[0.98] transition-all disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={busy || qty + scrap <= 0}
            className="w-full bg-emerald-500 text-white text-base font-bold py-4 rounded-2xl hover:bg-emerald-600 active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {busy ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-5 h-5" />
            )}
            {armed
              ? summary.primaryLabel
              : `Revisar ${qty} u${scrap > 0 ? ` · ${scrap} scrap` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmationReview({
  summary,
  armed,
}: {
  summary: OperatorConfirmationSummary;
  armed: boolean;
}) {
  const tone =
    summary.tone === "rose"
      ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-200"
      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200";

  return (
    <div className={`rounded-2xl border p-3 ${tone}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          {summary.tone === "rose" ? (
            <AlertTriangle className="w-5 h-5" />
          ) : (
            <CheckCircle2 className="w-5 h-5" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-black">
            {armed ? summary.title : "Revisión requerida"}
          </p>
          <p className="mt-1 text-xs leading-relaxed opacity-90">
            {summary.consequence}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {summary.details.map((detail) => (
              <span
                key={detail}
                className="rounded-full bg-white/60 px-2 py-1 text-[10px] font-black text-gray-700 dark:bg-black/20 dark:text-white"
              >
                {detail}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const INCIDENT_TYPES = [
  "Defecto visual",
  "Soldadura fría",
  "Componente dañado",
  "Falta material",
  "Otro",
];
const SEVERITIES: { id: string; label: string; color: string }[] = [
  { id: "low", label: "Baja", color: GRAY },
  { id: "medium", label: "Media", color: AMBER },
  { id: "high", label: "Alta", color: "#fb7185" },
  { id: "critical", label: "Crítica", color: RED },
];

function IncidentForm({
  board,
  operator,
  onQueueAction,
  onDone,
}: {
  board: Board;
  operator: string;
  onQueueAction: (
    action: Omit<OfflineAction, "id" | "createdAt" | "attempts">,
  ) => void;
  onDone: () => void;
}) {
  const step = board.currentStep!;
  const [type, setType] = useState(INCIDENT_TYPES[0]);
  const [severity, setSeverity] = useState("medium");
  const [qty, setQty] = useState(1);
  const [blocks, setBlocks] = useState(false);
  const [desc, setDesc] = useState("");
  const [evidenceNote, setEvidenceNote] = useState("");
  const [signature, setSignature] = useState(operator);
  const [quickNcr, setQuickNcr] = useState(false);
  const [photoNames, setPhotoNames] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function submit() {
    const evidence = [
      desc.trim(),
      evidenceNote.trim() ? `Evidencia: ${evidenceNote.trim()}` : "",
      photoNames.length ? `Fotos: ${photoNames.join(", ")}` : "",
      signature.trim() ? `Firma operador/calidad: ${signature.trim()}` : "",
      quickNcr ? "NCR rápido solicitado desde terminal." : "",
    ]
      .filter(Boolean)
      .join("\n");
    const payload = {
      type,
      severity,
      qtyAffected: qty,
      blocksFlow: blocks,
      description: evidence || undefined,
      operator,
    };
    setBusy(true);
    try {
      const res = await apiFetch(
        `${API_BASE}/mes/executions/${board.execution.id}/steps/${step.stepId}/incidents`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        toast.error(
          typeof j.message === "string"
            ? j.message
            : "No se pudo reportar el incidente.",
          "Calidad",
        );
        return;
      }
      onDone();
    } catch {
      onQueueAction({
        type: "incident",
        label: `Calidad ${type} · ${board.execution.workOrder}`,
        payload,
      });
      toast.error("Sin conexión: incidente guardado en cola local.", "Calidad");
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
            <Chip
              key={t}
              active={type === t}
              onClick={() => setType(t)}
              label={t}
            />
          ))}
        </div>
        <div className="flex gap-2">
          {SEVERITIES.map((s) => (
            <button
              key={s.id}
              onClick={() => setSeverity(s.id)}
              className={`flex-1 text-xs font-bold py-2 rounded-xl transition-all ${
                severity === s.id
                  ? "text-white"
                  : "text-gray-500 bg-gray-100 dark:bg-white/5"
              }`}
              style={
                severity === s.id ? { backgroundColor: s.color } : undefined
              }
            >
              {s.label}
            </button>
          ))}
        </div>
        <Stepper
          label="Unidades afectadas (se segregan)"
          value={qty}
          setValue={setQty}
          min={0}
        />
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Descripción del defecto"
          rows={2}
          className="w-full bg-gray-100 dark:bg-white/5 rounded-2xl px-4 py-3 outline-none text-sm"
        />
        <textarea
          value={evidenceNote}
          onChange={(e) => setEvidenceNote(e.target.value)}
          placeholder="Evidencia / comentarios de calidad (opcional)"
          rows={2}
          className="w-full bg-gray-100 dark:bg-white/5 rounded-2xl px-4 py-3 outline-none text-sm"
        />
        <label className="block rounded-2xl border border-dashed border-gray-300 dark:border-white/15 p-4 text-sm">
          <span className="flex items-center gap-2 font-black text-gray-600 dark:text-gray-200">
            <ImageIcon className="w-4 h-4" /> Fotos / evidencia visual
          </span>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(event) =>
              setPhotoNames(
                Array.from(event.target.files ?? []).map((file) => file.name),
              )
            }
            className="mt-3 w-full text-xs"
          />
          {photoNames.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {photoNames.map((name) => (
                <span
                  key={name}
                  className="rounded-full bg-rose-500/10 px-2 py-1 text-[10px] font-bold text-rose-500"
                >
                  {name}
                </span>
              ))}
            </div>
          )}
        </label>
        <input
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          placeholder="Firma / responsable"
          className="w-full bg-gray-100 dark:bg-white/5 rounded-2xl px-4 py-3 outline-none text-sm font-semibold"
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
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={quickNcr}
            onChange={(e) => setQuickNcr(e.target.checked)}
            className="w-5 h-5 accent-rose-500"
          />
          <span className="text-sm font-medium">
            Crear NCR rápido / requerir disposición formal
          </span>
        </label>
        <button
          onClick={submit}
          disabled={busy || !type}
          className="w-full bg-rose-500 text-white text-base font-bold py-4 rounded-2xl hover:bg-rose-600 active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {busy ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <AlertTriangle className="w-5 h-5" />
          )}
          Reportar incidente
        </button>
      </div>
    </div>
  );
}

function MaterialRequestForm({
  board,
  operator,
  onQueueAction,
  onCancel,
  onDone,
}: {
  board: Board;
  operator: string;
  onQueueAction: (
    action: Omit<OfflineAction, "id" | "createdAt" | "attempts">,
  ) => void;
  onCancel: () => void;
  onDone: () => void;
}) {
  const materials = board.currentStepDetail?.materials ?? [];
  const attentionMaterials = materials.filter(
    (material) =>
      material.short ||
      material.availableQty <= 0 ||
      material.availableQty < material.qtyPerUnit,
  );
  const defaultMaterial = attentionMaterials[0] ?? materials[0] ?? null;
  const [partNumber, setPartNumber] = useState(defaultMaterial?.partNumber ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const readiness = deriveMaterialRequestReadiness({
    kitId: board.execution.kitId,
    requests: board.materialRequests,
  });
  const selectedMaterial =
    materials.find((material) => material.partNumber === partNumber) ?? null;
  const stepName =
    board.currentStepDetail?.name ?? board.currentStep?.name ?? "estacion";

  function buildNote(): string {
    return [
      `MES manual · Linea ${board.execution.line ?? "?"} · ${stepName}`,
      `WO ${board.execution.workOrder}`,
      partNumber ? `Parte ${partNumber}` : "Solicitud general",
      selectedMaterial
        ? `Disponible ${selectedMaterial.availableQty}/${selectedMaterial.remaining} ${selectedMaterial.unit}`
        : null,
      note.trim() || null,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  async function submit() {
    const kitId = board.execution.kitId;
    if (!kitId || !readiness.canRequest) {
      setError(readiness.message);
      return;
    }

    const payload = {
      kitId,
      requestedBy: operator,
      note: buildNote(),
    };
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch(`${API_BASE}/material-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as {
          message?: string | string[];
        };
        const message = Array.isArray(j.message)
          ? j.message.join(", ")
          : j.message;
        setError(
          message ||
            "No se pudo crear la solicitud. Verifica permisos y kit publicado.",
        );
        return;
      }
      toast.success("Solicitud enviada a materiales.", "Material");
      onDone();
    } catch {
      onQueueAction({
        type: "material",
        label: `Material ${partNumber || "kit"} · ${board.execution.workOrder}`,
        payload,
      });
      setError("Sin conexion: solicitud guardada en cola local.");
      toast.error("Sin conexion: solicitud guardada en cola local.", "Material");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <SheetHeader title="Solicitar material" subtitle={stepName} />
      <div className="space-y-4">
        <div
          className={`rounded-2xl border p-3 text-sm ${
            readiness.status === "ready"
              ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
              : "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-200"
          }`}
        >
          <p className="font-black">{readiness.primaryLabel}</p>
          <p className="mt-1 text-xs leading-relaxed opacity-90">
            {readiness.message}
          </p>
        </div>

        {materials.length > 0 ? (
          <div>
            <div className="mb-2 text-xs font-black uppercase tracking-widest text-gray-500">
              Parte del paso
            </div>
            <div className="grid grid-cols-1 gap-2">
              {materials.map((material) => {
                const active = partNumber === material.partNumber;
                const needsAttention =
                  material.short ||
                  material.availableQty <= 0 ||
                  material.availableQty < material.qtyPerUnit;
                return (
                  <button
                    key={material.id}
                    onClick={() => setPartNumber(material.partNumber)}
                    className={`rounded-2xl border px-3 py-3 text-left transition-all ${
                      active
                        ? "border-amber-500 bg-amber-500 text-white"
                        : "border-gray-200 bg-gray-100 text-gray-700 hover:bg-gray-200 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-mono text-sm font-black">
                        {material.partNumber}
                      </span>
                      {needsAttention && (
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-black ${
                            active
                              ? "bg-white/20 text-white"
                              : "bg-amber-500/10 text-amber-700"
                          }`}
                        >
                          Revisar
                        </span>
                      )}
                    </span>
                    <span
                      className={`mt-1 block text-[11px] ${
                        active ? "text-white/80" : "text-gray-500"
                      }`}
                    >
                      Disponible {material.availableQty} · restante{" "}
                      {material.remaining} {material.unit}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-gray-100 px-3 py-3 text-xs font-bold text-gray-500 dark:bg-white/5 dark:text-gray-400">
            Esta estacion no trae materiales detallados; se levantara una
            solicitud general contra el kit.
          </div>
        )}

        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Nota para almacen / materialista"
          rows={3}
          className="w-full rounded-2xl bg-gray-100 px-4 py-3 text-sm outline-none dark:bg-white/5"
        />

        {error && <p className="text-sm font-semibold text-rose-500">{error}</p>}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[0.8fr_1.2fr]">
          <button
            onClick={onCancel}
            disabled={busy}
            className="w-full rounded-2xl bg-gray-100 py-4 text-base font-bold text-gray-700 transition-all hover:bg-gray-200 active:scale-[0.98] disabled:opacity-40 dark:bg-white/10 dark:text-gray-200 dark:hover:bg-white/15"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={busy || !readiness.canRequest}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 py-4 text-base font-black text-white transition-all hover:bg-amber-600 active:scale-[0.98] disabled:opacity-40"
          >
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Package className="h-5 w-5" />
            )}
            {readiness.primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function AndonForm({
  board,
  operator,
  onQueueAction,
  onDone,
}: {
  board: Board;
  operator: string;
  onQueueAction: (
    action: Omit<OfflineAction, "id" | "createdAt" | "attempts">,
  ) => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [stopPickerOpen, setStopPickerOpen] = useState(false);
  const [stopReason, setStopReason] = useState<DowntimeReasonCode | "">("");
  const [stopNote, setStopNote] = useState("");
  const [stopArmedSignature, setStopArmedSignature] = useState<string | null>(
    null,
  );
  const toast = useToast();
  const stopSummary = buildOperatorConfirmationSummary({
    action: "line-stop",
    workOrder: board.execution.workOrder,
    stepName: board.currentStep?.name,
    operator,
  });
  const stopSignature = buildOperatorActionSignature({
    action: "line-stop",
    workOrder: board.execution.workOrder,
    stepId: board.currentStep?.stepId,
    downtimeReason: stopReason || null,
    note: stopNote,
  });
  const stopArmed = stopArmedSignature === stopSignature;

  async function call(type: string, downtimeReason?: DowntimeReasonCode) {
    if (type === "stop" && !downtimeReason) {
      toast.error(
        "Selecciona una razón de paro antes de detener la línea.",
        "Andon",
      );
      return;
    }
    const reasonLabel =
      DOWNTIME_REASON_OPTIONS.find((reason) => reason.code === downtimeReason)
        ?.label ?? null;
    const payload = {
      type,
      stepId: board.currentStep?.stepId,
      raisedBy: operator,
      ...(downtimeReason
        ? {
            downtimeReason,
            note: stopNote.trim() || reasonLabel || undefined,
          }
        : {}),
    };
    setBusy(type);
    try {
      const res = await apiFetch(
        `${API_BASE}/mes/executions/${board.execution.id}/andon`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        toast.error(
          typeof j.message === "string"
            ? j.message
            : "No se pudo levantar el andon.",
          "Andon",
        );
        return;
      }
      onDone();
    } catch {
      onQueueAction({
        type: "andon",
        label: `Andon ${type}${reasonLabel ? ` · ${reasonLabel}` : ""} · ${
          board.execution.workOrder
        }`,
        payload,
      });
      toast.error("Sin conexión: Andon guardado en cola local.", "Andon");
    } finally {
      setBusy(null);
    }
  }

  function selectAndon(type: string) {
    if (type === "stop") {
      setStopPickerOpen(true);
      return;
    }
    void call(type);
  }

  function updateStopReason(reason: DowntimeReasonCode) {
    setStopReason(reason);
    setStopArmedSignature(null);
  }

  function updateStopNote(note: string) {
    setStopNote(note);
    setStopArmedSignature(null);
  }

  function cancelStop() {
    setStopPickerOpen(false);
    setStopReason("");
    setStopNote("");
    setStopArmedSignature(null);
  }

  function confirmStop() {
    if (!stopReason) {
      toast.error(
        "Selecciona una razón de paro antes de detener la línea.",
        "Andon",
      );
      return;
    }
    if (!stopArmed) {
      setStopArmedSignature(stopSignature);
      return;
    }
    void call("stop", stopReason);
  }

  return (
    <div>
      <SheetHeader title="Andon" subtitle="Llama a soporte a tu estación" />
      <div className="grid grid-cols-2 gap-3">
        {ANDON_TYPES.map((a) => (
          <button
            key={a.id}
            onClick={() => selectAndon(a.id)}
            disabled={!!busy}
            className={`${glass} rounded-3xl p-5 flex flex-col items-center gap-2 active:scale-95 transition-all disabled:opacity-50`}
            style={{ color: a.color }}
          >
            {busy === a.id ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              a.icon
            )}
            <span className="font-bold text-sm">{a.label}</span>
          </button>
        ))}
      </div>
      {stopPickerOpen && (
        <div className="mt-5 rounded-3xl border border-rose-500/20 bg-rose-500/10 p-4">
          <div className="mb-3">
            <ConfirmationReview summary={stopSummary} armed={stopArmed} />
          </div>
          <div className="mb-3">
            <div className="text-sm font-black text-rose-600">
              Razón de paro
            </div>
            <div className="text-xs text-gray-500">
              Se registra contra la WO activa.
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {DOWNTIME_REASON_OPTIONS.map((reason) => (
              <button
                key={reason.code}
                onClick={() => updateStopReason(reason.code)}
                className={`rounded-2xl px-3 py-3 text-left transition-all ${
                  stopReason === reason.code
                    ? "bg-rose-500 text-white"
                    : "bg-white/70 text-gray-700 hover:bg-white dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
                }`}
              >
                <span className="block text-sm font-black">{reason.label}</span>
                <span
                  className={`block text-[11px] ${
                    stopReason === reason.code
                      ? "text-white/80"
                      : "text-gray-500"
                  }`}
                >
                  {reason.description}
                </span>
              </button>
            ))}
          </div>
          <textarea
            value={stopNote}
            onChange={(event) => updateStopNote(event.target.value)}
            placeholder="Nota opcional para supervisor / mantenimiento"
            rows={2}
            className="mt-3 w-full rounded-2xl bg-white/80 px-4 py-3 text-sm outline-none dark:bg-white/10"
          />
          <button
            onClick={cancelStop}
            disabled={busy === "stop"}
            className="mt-3 flex w-full items-center justify-center rounded-2xl bg-white/70 py-4 text-base font-black text-gray-700 transition-all hover:bg-white active:scale-[0.98] disabled:opacity-40 dark:bg-white/10 dark:text-gray-200 dark:hover:bg-white/15"
          >
            Cancelar paro
          </button>
          <button
            onClick={confirmStop}
            disabled={busy === "stop" || !stopReason}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-500 py-4 text-base font-black text-white transition-all hover:bg-rose-600 active:scale-[0.98] disabled:opacity-40"
          >
            {busy === "stop" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <ShieldAlert className="h-5 w-5" />
            )}
            {stopArmed ? "Detener línea" : "Revisar paro"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Small shared bits ──────────────────────────────────────────────────────
function SheetHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-5">
      <h3 className="text-xl font-bold tracking-tight">{title}</h3>
      {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
    </div>
  );
}

function Chip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-xs font-semibold px-3 py-2 rounded-full transition-all ${
        active
          ? "bg-black text-white dark:bg-white dark:text-black"
          : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300"
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
      <div className="p-4 rounded-2xl bg-gray-100 dark:bg-white/5 text-gray-400 mb-4">
        {icon}
      </div>
      <h3 className="font-bold text-lg mb-1">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
        {body}
      </p>
    </div>
  );
}
