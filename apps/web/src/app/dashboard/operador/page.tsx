"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
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
  Wifi,
  WifiOff,
  Activity,
  Keyboard,
  QrCode,
  BluetoothConnected,
  Usb,
  History,
  Volume2,
  Maximize2,
  Minimize2,
  ExternalLink,
  BookOpenCheck,
  PlaySquare,
  GitBranch,
  ListChecks,
  RefreshCw,
  Zap,
  HelpCircle,
  Users,
  Truck,
  Hammer,
} from "lucide-react";
import { glass } from "@/lib/glass";
import { setOperatorKiosk } from "@/lib/operatorChrome";
import { useApi } from "@/hooks/useApi";
import { useDialogA11y } from "@/hooks/useDialogA11y";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/contexts/ToastContext";
import { useMesSignals } from "@/hooks/useMesSignals";
import { useDashboardSession } from "@/hooks/useDashboardSession";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
).replace(/\/$/, "");

const GREEN = "#10b981";
const AMBER = "#f59e0b";
const RED = "#ef4444";
const GRAY = "#6b7280";

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
interface VisualAid {
  kind: "image" | "pdf" | "office" | "video" | "cad";
  id: string;
  title?: string;
  fileUrl?: string;
  documentUrl?: string;
  version?: string;
  revision?: string;
  updatedAt?: string;
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

const STEP_META: Record<StepStatus, { label: string; color: string }> = {
  pending: { label: "Pendiente", color: GRAY },
  in_process: { label: "En proceso", color: AMBER },
  blocked: { label: "Bloqueado", color: RED },
  completed: { label: "Completado", color: GREEN },
};

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

function formatDuration(sec: number) {
  const safe = Math.max(0, Math.floor(sec));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

type ScanKind =
  | "wo"
  | "serial"
  | "lot"
  | "material"
  | "qr"
  | "datamatrix"
  | "code128";
type ScanState = "idle" | "reading" | "valid" | "invalid";

interface ScanResult {
  raw: string;
  normalized: string;
  kind: ScanKind;
  valid: boolean;
  message: string;
  at: string;
}

const SCANNER_BUFFER_TIMEOUT_MS = 75;
const SCAN_HISTORY_LIMIT = 6;

function classifyScan(raw: string): Omit<ScanResult, "at"> {
  const normalized = raw.trim();
  const upper = normalized.toUpperCase();
  if (!normalized) {
    return {
      raw,
      normalized,
      kind: "code128",
      valid: false,
      message: "Escaneo vacío. Intenta de nuevo.",
    };
  }
  if (/^WO[-_:\s]?[A-Z0-9-]{3,}$/i.test(upper) || /^[0-9]{5,}$/.test(upper)) {
    return {
      raw,
      normalized: upper.replace(/^WO[-_:\s]?/i, ""),
      kind: "wo",
      valid: true,
      message: "WO detectada y lista para montar.",
    };
  }
  if (/^(SN|SERIAL)[-_:\s]?[A-Z0-9-]{4,}$/i.test(upper)) {
    return {
      raw,
      normalized: upper.replace(/^(SN|SERIAL)[-_:\s]?/i, "SN-"),
      kind: "serial",
      valid: true,
      message: "Número de serie capturado.",
    };
  }
  if (/^(LOT|LOTE)[-_:\s]?[A-Z0-9-]{3,}$/i.test(upper)) {
    return {
      raw,
      normalized: upper.replace(/^(LOT|LOTE)[-_:\s]?/i, "LOT-"),
      kind: "lot",
      valid: true,
      message: "Lote detectado para trazabilidad.",
    };
  }
  if (/^(MAT|PN|MPN)[-_:\s]?[A-Z0-9_.-]{3,}$/i.test(upper)) {
    return {
      raw,
      normalized: upper.replace(/^(MAT|PN|MPN)[-_:\s]?/i, ""),
      kind: "material",
      valid: true,
      message: "Material detectado.",
    };
  }
  if (/^\]C1/.test(normalized)) {
    return {
      raw,
      normalized: normalized.slice(3),
      kind: "code128",
      valid: true,
      message: "Code128 GS1 capturado.",
    };
  }
  if (
    /^\]D2/.test(normalized) ||
    normalized.includes(String.fromCharCode(29))
  ) {
    return {
      raw,
      normalized: normalized
        .replace(/^\]D2/, "")
        .replaceAll(String.fromCharCode(29), "|"),
      kind: "datamatrix",
      valid: true,
      message: "DataMatrix capturado.",
    };
  }
  if (/^https?:\/\//i.test(normalized) || /^[A-Z0-9]{12,}$/.test(upper)) {
    return {
      raw,
      normalized,
      kind: "qr",
      valid: true,
      message: "QR capturado.",
    };
  }
  return {
    raw,
    normalized,
    kind: "code128",
    valid: normalized.length >= 3,
    message:
      normalized.length >= 3
        ? "Código capturado; valida que corresponda al campo activo."
        : "Código demasiado corto para validación industrial.",
  };
}

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
  onRefresh,
  onCancel,
}: {
  enabled: boolean;
  onConfirm: () => void;
  onIncident: () => void;
  onAndon: () => void;
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
      if (event.key === "F4") onAndon();
      if (event.key === "F5") onRefresh();
      if (event.key === "F6") onAndon();
      if (event.key === "F7") onIncident();
      if (event.key === "Escape") onCancel();
      if (event.key === "Enter") onConfirm();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, onAndon, onCancel, onConfirm, onIncident, onRefresh]);
}

export default function OperadorPage() {
  const { session } = useDashboardSession();
  const operator = session?.name || session?.email || "Operador";
  const now = useOperatorClock();
  // Modo Kiosko: oculta el chrome global de AXOS (topbar, wayfinding, dock) y los
  // widgets flotantes para una vista de línea enfocada. El TEMA (claro/oscuro) NO
  // se maneja aquí: viene del ThemeProvider global vía `.dark` en <html>.
  const [kiosk, setKiosk] = useState(false);
  const [gloveMode, setGloveMode] = useState(true);

  // Sincroniza el modo Kiosko con el store compartido (lo leen el shell del
  // dashboard y los widgets flotantes). Al salir de la pantalla se restablece
  // para no dejar el chrome global oculto en otras rutas.
  useEffect(() => {
    setOperatorKiosk(kiosk);
  }, [kiosk]);
  useEffect(() => () => setOperatorKiosk(false), []);

  const [executionId, setExecutionId] = useState<number | null>(null);
  const [stepId, setStepId] = useState<number | null>(null);
  const [sheet, setSheet] = useState<"confirm" | "incident" | "andon" | null>(
    null,
  );

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

  useOperatorShortcuts({
    enabled: !!executionId,
    onConfirm: () => setSheet("confirm"),
    onIncident: () => setSheet("incident"),
    onAndon: () => setSheet("andon"),
    onRefresh: () => {
      mutateList();
      if (executionId) mutateBoard();
    },
    onCancel: () => setSheet(null),
  });

  return (
    <div
      className={`min-h-screen font-sans bg-background text-foreground ${kiosk ? "pb-44" : "pb-56"} ${gloveMode ? "[&_*]:touch-manipulation" : ""}`}
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
        kiosk={kiosk}
        onToggleGlove={() => setGloveMode((v) => !v)}
        onToggleKiosk={() => setKiosk((v) => !v)}
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
            kiosk={kiosk}
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
            {sheet === "confirm" && (
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
            {sheet === "incident" && (
              <IncidentForm
                board={board}
                operator={operator}
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
  kiosk,
  onSelectStep,
  onOpenSheet,
  refresh,
}: {
  board: Board;
  operator: string;
  position: string | null;
  kiosk: boolean;
  onSelectStep: (stepId: number) => void;
  onOpenSheet: (s: "confirm" | "incident" | "andon") => void;
  refresh: () => void;
}) {
  const { execution, steps, currentStep, currentStepDetail } = board;
  const totalDone = steps.reduce((s, st) => s + st.unitsCompleted, 0);
  const totalTarget = execution.quantity * (steps.length || 1);
  const overall = totalTarget ? totalDone / totalTarget : 0;
  const blocked = currentStep?.status === "blocked";

  return (
    <div>
      {/* WO banner */}
      <div className={`${glass} rounded-3xl p-5 mb-5`}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[11px] font-mono text-gray-400 mb-0.5">
              WO {execution.workOrder} · rev {execution.revision}
            </div>
            <div className="text-3xl font-bold tracking-tight">
              {execution.model}
            </div>
            <div className="text-sm text-gray-500">
              Línea {execution.line ?? "—"} · {execution.quantity} unidades
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold tabular-nums">
              {Math.round(overall * 100)}%
            </div>
            <div className="text-[11px] text-gray-500">avance total</div>
          </div>
        </div>
        <div className="mt-3">
          <ProgressBar value={overall} />
        </div>
      </div>

      <ProductionPanel board={board} overall={overall} />

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
                active
                  ? "ring-2 ring-amber-400"
                  : "opacity-80 hover:opacity-100"
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
                {s.scrapQty > 0 ? ` · ${s.scrapQty} scrap` : ""}
              </div>
            </button>
          );
        })}
      </div>

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
                    STEP_META[currentStep?.status ?? "pending"].color,
                }}
              />
              {currentStepDetail?.name ?? "Estación"}
            </h3>
            <span className="text-[11px] text-gray-400">
              {currentStep ? `${STEP_META[currentStep.status].label}` : ""}
            </span>
          </div>
          <WorkInstructionPanel
            aid={currentStepDetail?.visualAid ?? null}
            instructions={currentStepDetail?.instructions ?? null}
            stepName={currentStepDetail?.name ?? "Estación"}
          />
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

      <QualitySidePanel
        board={board}
        onOpenIncident={() => onOpenSheet("incident")}
      />

      <ExtendedOperationsPanel
        board={board}
        refresh={refresh}
        onOpenSheet={onOpenSheet}
      />

      {/* Open incidents (quality can disposition here) */}
      {currentStepDetail && currentStepDetail.openIncidents.length > 0 && (
        <div className="mt-5 space-y-3">
          {currentStepDetail.openIncidents.map((i) => (
            <IncidentRow key={i.id} i={i} refresh={refresh} />
          ))}
        </div>
      )}

      {/* Andon / downtime strip */}
      {(board.andons.filter((a) => a.status !== "resolved").length > 0 ||
        board.materialRequests.length > 0) && (
        <div className="mt-5 flex flex-wrap gap-2">
          {board.andons
            .filter((a) => a.status !== "resolved")
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

      {/* Barra de acciones críticas. En modo integrado se eleva por encima del
          dock global de AXOS para que "Confirmar avance" nunca quede debajo de
          la navegación; en Kiosko el dock no existe y baja al borde inferior. */}
      <div
        className={`${glass} fixed ${kiosk ? "bottom-4" : "bottom-28"} left-1/2 -translate-x-1/2 z-40 px-3 py-3 rounded-[2rem] shadow-2xl flex items-center gap-2 w-[min(920px,94vw)]`}
      >
        <button
          onClick={() => onOpenSheet("confirm")}
          disabled={blocked || currentStep?.status === "completed"}
          className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 text-white text-xl font-black px-6 py-6 rounded-3xl hover:bg-emerald-600 active:scale-[0.98] transition-all disabled:opacity-40"
        >
          <CheckCircle2 className="w-5 h-5" /> Confirmar avance
        </button>
        <button
          onClick={() => onOpenSheet("incident")}
          className="flex items-center justify-center gap-2 bg-rose-500/10 text-rose-600 text-base font-black px-5 py-6 rounded-3xl hover:bg-rose-500/20 active:scale-95 transition-all"
        >
          <AlertTriangle className="w-5 h-5" />{" "}
          <span className="hidden sm:inline">Incidente</span>
        </button>
        <button
          onClick={() => onOpenSheet("andon")}
          className="flex items-center justify-center gap-2 bg-amber-500/10 text-amber-700 text-base font-black px-5 py-6 rounded-3xl hover:bg-amber-500/20 active:scale-95 transition-all"
        >
          <Bell className="w-5 h-5" />{" "}
          <span className="hidden sm:inline">Andon</span>
        </button>
      </div>
      <input type="hidden" value={`${operator}/${position ?? ""}`} readOnly />
    </div>
  );
}

function ScannerPanel({
  state,
  lastScan,
  history,
  expected,
  compact = false,
}: {
  state: ScanState;
  lastScan: ScanResult | null;
  history: ScanResult[];
  expected: "wo" | "serial";
  compact?: boolean;
}) {
  const stateMeta =
    state === "reading"
      ? { label: "Leyendo scanner…", color: AMBER }
      : state === "valid"
        ? { label: "Lectura válida", color: GREEN }
        : state === "invalid"
          ? { label: "Lectura inválida", color: RED }
          : { label: "Scanner listo", color: GRAY };
  return (
    <section className={`${glass} rounded-3xl ${compact ? "p-3" : "p-4 mb-5"}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="w-12 h-12 rounded-2xl grid place-items-center text-white shadow-lg"
          style={{ backgroundColor: stateMeta.color }}
        >
          <ScanLine className="w-6 h-6" />
        </div>
        <div className="mr-auto">
          <div className="text-sm font-black">{stateMeta.label}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Keyboard wedge · USB · Bluetooth · QR · DataMatrix · Code128
          </div>
        </div>
        <ScannerCapability
          icon={<Keyboard className="w-4 h-4" />}
          label="Wedge"
        />
        <ScannerCapability icon={<Usb className="w-4 h-4" />} label="USB" />
        <ScannerCapability
          icon={<BluetoothConnected className="w-4 h-4" />}
          label="BT"
        />
        <ScannerCapability icon={<QrCode className="w-4 h-4" />} label="2D" />
        <ScannerCapability
          icon={<Volume2 className="w-4 h-4" />}
          label="Beep"
        />
      </div>
      {lastScan && (
        <div
          className="mt-3 rounded-2xl border px-3 py-2 text-sm"
          style={{ borderColor: `${lastScan.valid ? GREEN : RED}66` }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono font-black">{lastScan.normalized}</span>
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
              {lastScan.kind}
            </span>
            <span
              className={lastScan.valid ? "text-emerald-500" : "text-rose-500"}
            >
              {lastScan.message}
            </span>
          </div>
          {expected === "wo" && lastScan.valid && lastScan.kind !== "wo" && (
            <div className="mt-1 text-xs text-amber-500">
              Código válido, pero esta zona espera una WO.
            </div>
          )}
        </div>
      )}
      {!compact && history.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
          <span className="flex items-center gap-1 text-gray-500 font-bold">
            <History className="w-3.5 h-3.5" /> Últimas lecturas
          </span>
          {history.map((item) => (
            <span
              key={`${item.at}-${item.raw}`}
              className={`rounded-full px-2 py-1 font-mono ${item.valid ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"}`}
            >
              {item.normalized}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function ScannerCapability({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <span className="min-h-9 px-3 rounded-2xl bg-white/10 flex items-center gap-1.5 text-xs font-black text-gray-600 dark:text-gray-200">
      {icon}
      {label}
    </span>
  );
}

function IndustrialTopBar({
  execution,
  currentStep,
  operator,
  shift,
  clock,
  socketStatus,
  alerts,
  gloveMode,
  kiosk,
  onToggleGlove,
  onToggleKiosk,
  onBack,
}: {
  execution: Board["execution"] | null;
  currentStep: StepView | null;
  operator: string;
  shift: string;
  clock: string;
  socketStatus: string;
  alerts: number;
  gloveMode: boolean;
  kiosk: boolean;
  onToggleGlove: () => void;
  onToggleKiosk: () => void;
  onBack: (() => void) | null;
}) {
  const machine =
    currentStep?.status === "blocked"
      ? "Máquina bloqueada"
      : currentStep?.starved
        ? "Esperando flujo"
        : "Lista";
  const quality =
    currentStep?.status === "blocked" ? "Hold calidad" : "Calidad OK";
  return (
    <div
      className={`${glass} sticky ${kiosk ? "top-0" : "top-20"} z-40 border-x-0 border-t-0 rounded-none px-4 py-3 shadow-2xl`}
    >
      <div className="flex flex-wrap items-center gap-3">
        {onBack ? (
          <button
            onClick={onBack}
            className="min-h-12 rounded-2xl px-4 font-bold bg-white/10 hover:bg-white/15 active:scale-95 transition-all flex items-center gap-2"
          >
            <ChevronLeft className="w-5 h-5" /> Órdenes
          </button>
        ) : (
          <Link
            href="/dashboard"
            className="min-h-12 rounded-2xl px-4 font-bold bg-white/10 hover:bg-white/15 active:scale-95 transition-all flex items-center gap-2"
          >
            <ChevronLeft className="w-5 h-5" /> Dashboard
          </Link>
        )}
        <div className="flex items-center gap-2 font-black text-lg tracking-tight mr-auto">
          <Factory className="w-6 h-6 text-amber-400" /> AXOS MES Terminal
        </div>
        <StatusPill
          icon={<Clock className="w-4 h-4" />}
          label={clock}
          tone="neutral"
        />
        <StatusPill
          icon={
            socketStatus === "connected" ? (
              <Wifi className="w-4 h-4" />
            ) : (
              <WifiOff className="w-4 h-4" />
            )
          }
          label={
            socketStatus === "connected" ? "Online" : "Offline / cola local"
          }
          tone={socketStatus === "connected" ? "green" : "amber"}
        />
        <StatusPill
          icon={<Bell className="w-4 h-4" />}
          label={`${alerts} alertas`}
          tone={alerts > 0 ? "red" : "green"}
        />
        <button
          onClick={onToggleGlove}
          aria-pressed={gloveMode}
          className={`min-h-12 rounded-2xl px-4 font-black transition-all ${gloveMode ? "bg-amber-400 text-slate-950" : "bg-black/5 dark:bg-white/10"}`}
        >
          Guantes {gloveMode ? "ON" : "OFF"}
        </button>
        <button
          onClick={onToggleKiosk}
          aria-pressed={kiosk}
          title={kiosk ? "Salir de pantalla completa" : "Modo Kiosko"}
          className={`min-h-12 rounded-2xl px-4 font-black transition-all flex items-center gap-2 ${kiosk ? "bg-amber-400 text-slate-950" : "bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 active:scale-95"}`}
        >
          {kiosk ? (
            <Minimize2 className="w-5 h-5" />
          ) : (
            <Maximize2 className="w-5 h-5" />
          )}
          <span className="hidden sm:inline">Kiosko</span>
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-9 gap-2 text-xs">
        <InfoCell label="Operador" value={operator} />
        <InfoCell label="Turno" value={shift} />
        <InfoCell
          label="Línea"
          value={execution?.line ? `Línea ${execution.line}` : "—"}
        />
        <InfoCell label="Estación" value={currentStep?.name ?? "Sin montar"} />
        <InfoCell label="WO" value={execution?.workOrder ?? "—"} />
        <InfoCell label="Modelo" value={execution?.model ?? "—"} />
        <InfoCell
          label="Tiempo restante"
          value={
            currentStep
              ? `${Math.max(0, currentStep.unitsTarget - currentStep.unitsCompleted)} u`
              : "—"
          }
        />
        <InfoCell label="Máquina" value={machine} />
        <InfoCell label="Calidad" value={quality} />
      </div>
    </div>
  );
}

function StatusPill({
  icon,
  label,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  tone: "green" | "amber" | "red" | "neutral";
}) {
  const cls =
    tone === "green"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : tone === "amber"
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
        : tone === "red"
          ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
          : "bg-black/5 text-slate-700 dark:bg-white/10 dark:text-slate-200";
  return (
    <span
      className={`min-h-10 px-3 rounded-2xl flex items-center gap-2 text-xs font-black ${cls}`}
    >
      {icon}
      {label}
    </span>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-black/[0.04] dark:bg-white/5 border border-black/10 dark:border-white/10 px-3 py-2 min-h-14">
      <div className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="font-black truncate">{value}</div>
    </div>
  );
}

function ProductionPanel({
  board,
  overall,
}: {
  board: Board;
  overall: number;
}) {
  const target = board.execution.quantity;
  const real = Math.max(...board.steps.map((s) => s.unitsCompleted), 0);
  const scrap = board.steps.reduce((sum, s) => sum + s.scrapQty, 0);
  const rework = board.steps.reduce((sum, s) => sum + s.segregatedQty, 0);
  const downtime =
    board.downtimeSummarySec +
    board.openDowntime.reduce((sum, d) => sum + d.durationSec, 0);
  const yieldPct = real + scrap > 0 ? real / (real + scrap) : 1;
  const wip = board.steps.reduce(
    (sum, s) => sum + Math.max(0, s.unitsCompleted - real),
    0,
  );
  const cards = [
    ["Objetivo", target, "u"],
    ["Real", real, "u"],
    ["Restante", Math.max(0, target - real), "u"],
    ["Takt", "—", "s/u"],
    ["UPH", "—", "u/h"],
    ["OEE", Math.round(overall * 100), "%"],
    ["Yield", Math.round(yieldPct * 100), "%"],
    ["Scrap", scrap, "u"],
    ["Rework", rework, "u"],
    ["Downtime", formatDuration(downtime), ""],
    ["WIP", wip, "u"],
  ] as const;
  return (
    <section className="mb-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-11 gap-3">
      {cards.map(([label, value, unit]) => (
        <div
          key={label}
          className={`${glass} rounded-3xl p-4 min-h-28 flex flex-col justify-between`}
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-widest">
              {label}
            </span>
            <Activity className="w-4 h-4" />
          </div>
          <div className="text-3xl font-black tabular-nums tracking-tight">
            {value}
            <span className="text-sm text-slate-400 ml-1">{unit}</span>
          </div>
        </div>
      ))}
    </section>
  );
}

function resolveAidUrl(aid: VisualAid | null) {
  if (!aid) return null;
  const url = aid.fileUrl || aid.documentUrl || null;
  if (!url) return null;
  return url.startsWith("http") ? url : `${API_BASE}${url}`;
}

function visualAidMode(aid: VisualAid | null) {
  const url = resolveAidUrl(aid)?.toLowerCase() ?? "";
  if (!aid) return "empty" as const;
  if (aid.kind === "video" || /\.(mp4|webm|mov)(\?|$)/.test(url))
    return "video" as const;
  if (aid.kind === "image" || /\.(png|jpe?g|gif|webp|svg)(\?|$)/.test(url))
    return "image" as const;
  if (aid.kind === "pdf" || /\.pdf(\?|$)/.test(url)) return "pdf" as const;
  if (
    aid.kind === "cad" ||
    /\.(step|stp|iges|igs|dxf|dwg|stl|obj)(\?|$)/.test(url)
  )
    return "cad" as const;
  return "office" as const;
}

function WorkInstructionPanel({
  aid,
  instructions,
  stepName,
}: {
  aid: VisualAid | null;
  instructions: string | null;
  stepName: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const href = resolveAidUrl(aid);
  const mode = visualAidMode(aid);
  const version = aid?.version || aid?.revision || "versión vigente";
  const container = expanded
    ? "fixed inset-4 z-[60] rounded-[2rem] bg-slate-950/95 p-4 shadow-2xl"
    : "";
  return (
    <div className={container}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-2 text-sm font-black">
          <BookOpenCheck className="w-4 h-4 text-amber-400" /> Instrucción de
          trabajo
        </span>
        <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-300">
          {mode === "empty" ? "sin archivo" : mode}
        </span>
        <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-600">
          {version}
        </span>
        <span className="ml-auto text-[11px] font-semibold text-gray-500 dark:text-gray-400">
          {stepName}
        </span>
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="min-h-10 rounded-2xl bg-white/10 px-3 text-xs font-black flex items-center gap-1.5 hover:bg-white/15 transition-colors"
          >
            <ExternalLink className="w-4 h-4" /> Respaldo
          </a>
        )}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="min-h-10 rounded-2xl bg-white/10 px-3 text-xs font-black flex items-center gap-1.5 hover:bg-white/15 active:scale-95 transition-all"
        >
          {expanded ? (
            <Minimize2 className="w-4 h-4" />
          ) : (
            <Maximize2 className="w-4 h-4" />
          )}
          {expanded ? "Compactar" : "Ampliar"}
        </button>
      </div>

      <div
        className={
          expanded
            ? "grid h-[calc(100%-3.5rem)] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4"
            : "space-y-3"
        }
      >
        <EmbeddedAid aid={aid} href={href} mode={mode} expanded={expanded} />
        <div
          className={`${expanded ? "overflow-y-auto rounded-3xl bg-white/5 p-4" : ""}`}
        >
          {instructions ? (
            <div className="rounded-2xl bg-amber-500/10 p-4 text-sm leading-6 text-gray-700 dark:text-gray-200 whitespace-pre-line">
              {instructions}
            </div>
          ) : (
            <div className="rounded-2xl bg-white/5 p-4 text-sm text-gray-500">
              No hay instrucciones textuales para este paso. Usa la ayuda visual
              embebida o solicita ingeniería si falta el documento controlado.
            </div>
          )}
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px] font-black uppercase tracking-widest text-gray-500">
            <div className="rounded-2xl bg-white/5 p-2">Controlado</div>
            <div className="rounded-2xl bg-white/5 p-2">Embebido</div>
            <div className="rounded-2xl bg-white/5 p-2">
              Sin cambio de pantalla
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmbeddedAid({
  aid,
  href,
  mode,
  expanded,
}: {
  aid: VisualAid | null;
  href: string | null;
  mode: ReturnType<typeof visualAidMode>;
  expanded: boolean;
}) {
  const frameClass = expanded
    ? "h-full min-h-[480px]"
    : "aspect-video max-h-[420px]";
  if (!aid || !href) {
    return (
      <div
        className={`${frameClass} rounded-2xl bg-gray-100 dark:bg-white/5 grid place-items-center text-gray-400 text-sm`}
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <ImageIcon className="w-7 h-7" />
          Sin ayuda visual ligada a este paso
        </div>
      </div>
    );
  }
  if (mode === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={href}
        alt={aid.title || "Ayuda visual"}
        className={`${frameClass} w-full object-contain rounded-2xl bg-gray-50 dark:bg-white/5`}
      />
    );
  }
  if (mode === "video") {
    return (
      <video
        src={href}
        controls
        playsInline
        className={`${frameClass} w-full rounded-2xl bg-black object-contain`}
      />
    );
  }
  if (mode === "cad") {
    return (
      <div
        className={`${frameClass} rounded-2xl bg-slate-900 grid place-items-center p-6 text-center text-slate-200`}
      >
        <div className="max-w-md space-y-3">
          <PlaySquare className="mx-auto w-9 h-9 text-amber-400" />
          <div className="text-lg font-black">CAD / modelo técnico ligado</div>
          <p className="text-sm text-slate-400">
            El visor 3D embebido requiere el contrato de CAD del siguiente
            slice; el archivo queda disponible aquí sin abandonar la terminal.
          </p>
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center rounded-2xl bg-amber-400 px-4 text-sm font-black text-slate-950"
          >
            Abrir archivo controlado
          </a>
        </div>
      </div>
    );
  }
  return (
    <iframe
      title={aid.title || "Ayuda visual embebida"}
      src={href}
      className={`${frameClass} w-full rounded-2xl border border-white/10 bg-white`}
      loading="lazy"
    />
  );
}

function MaterialRow({ m }: { m: Material }) {
  const pct = m.plannedQty > 0 ? Math.min(1, m.consumedQty / m.plannedQty) : 0;
  const color = m.short
    ? RED
    : m.availableQty <= m.plannedQty * 0.15
      ? AMBER
      : GREEN;
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="font-mono font-semibold">{m.partNumber}</span>
        <span className="tabular-nums text-gray-500">
          {m.consumedQty}/{m.plannedQty} {m.unit}
          {m.short && (
            <span className="ml-2 text-rose-500 font-bold">FALTA</span>
          )}
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct * 100}%`, backgroundColor: color }}
        />
      </div>
      {m.description && (
        <div className="text-[11px] text-gray-400 mt-0.5">{m.description}</div>
      )}
    </div>
  );
}

function ExtendedOperationsPanel({
  board,
  refresh,
  onOpenSheet,
}: {
  board: Board;
  refresh: () => void;
  onOpenSheet: (sheet: "confirm" | "incident" | "andon") => void;
}) {
  const activeAndons = board.andons.filter(
    (andon) => andon.status !== "resolved",
  );
  const timeline = [
    ...activeAndons.map((andon) => ({
      id: `andon-${andon.id}`,
      at: andon.createdAt,
      label: `Andon ${andon.type}`,
      detail: andon.note || andon.status,
      tone: "red" as const,
    })),
    ...(board.currentStepDetail?.openIncidents ?? []).map((incident) => ({
      id: `incident-${incident.id}`,
      at: incident.createdAt,
      label: `Calidad · ${incident.type}`,
      detail: incident.disposition || incident.severity,
      tone: incident.blocksFlow ? ("red" as const) : ("amber" as const),
    })),
    ...board.openDowntime.map((down) => ({
      id: `down-${down.id}`,
      at: down.startedAt,
      label: `Paro · ${down.reason}`,
      detail: down.endedAt ? "cerrado" : "abierto",
      tone: "amber" as const,
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const genealogyNodes = [
    { label: "WO", value: board.execution.workOrder },
    { label: "Modelo", value: board.execution.model },
    { label: "Rev", value: board.execution.revision },
    {
      label: "Línea",
      value: board.execution.line ? `L${board.execution.line}` : "—",
    },
  ];

  return (
    <section className={`${glass} mt-5 rounded-3xl p-5`}>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-400 grid place-items-center">
          <Zap className="w-6 h-6" />
        </div>
        <div className="mr-auto">
          <h3 className="text-lg font-black tracking-tight">
            Centro rápido de ejecución
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Andon, material, genealogía, historial, shortcuts, offline y
            performance en un solo bloque.
          </p>
        </div>
        <button
          onClick={refresh}
          className="min-h-12 rounded-2xl bg-white/10 px-4 text-xs font-black flex items-center gap-2 hover:bg-white/15 active:scale-95 transition-all"
        >
          <RefreshCw className="w-4 h-4" /> F5 Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="rounded-3xl bg-white/5 p-4 border border-white/10">
          <PanelTitle
            icon={<Bell className="w-4 h-4" />}
            title="Andon extendido"
          />
          <div className="grid grid-cols-2 gap-2">
            {ANDON_TYPES.map((andon) => (
              <button
                key={andon.id}
                onClick={() => onOpenSheet("andon")}
                className="min-h-16 rounded-2xl bg-white/5 p-3 text-left text-xs font-black active:scale-95 transition-all hover:bg-white/10"
                style={{ color: andon.color }}
              >
                <span className="flex items-center gap-2">
                  {andon.icon}
                  {andon.label}
                </span>
                <span className="mt-1 block text-[10px] text-gray-500">
                  respuesta objetivo &lt;5m
                </span>
              </button>
            ))}
          </div>
          <div className="mt-3 text-xs text-gray-500">
            Activos: {activeAndons.length || 0} · SLA visible para supervisor,
            calidad, materialista, mantenimiento, ingeniería y tooling.
          </div>
        </div>

        <div className="rounded-3xl bg-white/5 p-4 border border-white/10">
          <PanelTitle
            icon={<Truck className="w-4 h-4" />}
            title="Material / Kanban"
          />
          <div className="space-y-2">
            {board.materialRequests.length ? (
              board.materialRequests.map((request) => (
                <div
                  key={request.id}
                  className="rounded-2xl bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-600"
                >
                  Kanban #{request.id} · {request.status}{" "}
                  {request.note ? `· ${request.note}` : ""}
                </div>
              ))
            ) : (
              <div className="rounded-2xl bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-600">
                Sin material pendiente · inventario cercano OK
              </div>
            )}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px] font-black uppercase tracking-widest text-gray-500">
            <div className="rounded-2xl bg-white/5 p-2">Milk run</div>
            <div className="rounded-2xl bg-white/5 p-2">ETA</div>
            <div className="rounded-2xl bg-white/5 p-2">WIP</div>
          </div>
        </div>

        <div className="rounded-3xl bg-white/5 p-4 border border-white/10">
          <PanelTitle
            icon={<GitBranch className="w-4 h-4" />}
            title="Genealogía embebida"
          />
          <div className="grid grid-cols-2 gap-2">
            {genealogyNodes.map((node) => (
              <div key={node.label} className="rounded-2xl bg-white/5 p-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                  {node.label}
                </div>
                <div className="font-mono text-sm font-black truncate">
                  {node.value}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-gray-500">
            Serial padre/hijos, consumos y eventos quedan reservados para el
            contrato de genealogía vivo.
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="rounded-3xl bg-white/5 p-4 border border-white/10 xl:col-span-2">
          <PanelTitle
            icon={<ListChecks className="w-4 h-4" />}
            title="Timeline cronológica"
          />
          <div className="max-h-44 overflow-y-auto space-y-2 pr-1">
            {timeline.length ? (
              timeline.slice(0, 8).map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl bg-white/5 px-3 py-2 text-xs flex items-center gap-3"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{
                      backgroundColor: item.tone === "red" ? RED : AMBER,
                    }}
                  />
                  <span className="font-black">{item.label}</span>
                  <span className="text-gray-500 truncate">{item.detail}</span>
                  <span className="ml-auto font-mono text-[10px] text-gray-500">
                    {new Date(item.at).toLocaleTimeString("es-MX", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))
            ) : (
              <div className="rounded-2xl bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-600">
                Sin alertas, paros o calidad abiertos en esta estación.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl bg-white/5 p-4 border border-white/10">
          <PanelTitle
            icon={<Keyboard className="w-4 h-4" />}
            title="Atajos / Offline / Performance"
          />
          <div className="grid grid-cols-2 gap-2 text-[11px] font-black">
            {[
              "F1 Ayuda",
              "F2 Scrap",
              "F3 Retrabajo",
              "F4 Material",
              "F5 Refresh",
              "F6 Supervisor",
              "F7 Calidad",
              "ESC Cancelar",
              "ENTER Confirmar",
            ].map((shortcut) => (
              <div key={shortcut} className="rounded-xl bg-white/5 px-2 py-1.5">
                {shortcut}
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-2xl bg-amber-500/10 p-3 text-amber-600 font-bold flex items-center gap-2">
              <WifiOff className="w-4 h-4" /> Cola local preparada
            </div>
            <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-600 font-bold flex items-center gap-2">
              <Zap className="w-4 h-4" /> UI &lt;100ms objetivo
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PanelTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h4 className="mb-3 flex items-center gap-2 text-sm font-black">
      {icon}
      {title}
    </h4>
  );
}

function QualitySidePanel({
  board,
  onOpenIncident,
}: {
  board: Board;
  onOpenIncident: () => void;
}) {
  const incidents = board.currentStepDetail?.openIncidents ?? [];
  const scrap = board.steps.reduce((sum, step) => sum + step.scrapQty, 0);
  const rework = board.steps.reduce((sum, step) => sum + step.segregatedQty, 0);
  const blocking = incidents.filter((incident) => incident.blocksFlow).length;
  const evidenceReady = incidents.filter(
    (incident) => !!incident.description,
  ).length;
  return (
    <aside className={`${glass} mt-5 rounded-3xl p-5`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/15 text-rose-500 grid place-items-center">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div className="mr-auto">
          <h3 className="text-lg font-black tracking-tight">
            Calidad en línea
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Defectos, scrap, retrabajo, evidencia, firma y NCR rápido desde la
            estación.
          </p>
        </div>
        <button
          onClick={onOpenIncident}
          className="min-h-14 rounded-2xl bg-rose-500 px-5 text-sm font-black text-white hover:bg-rose-600 active:scale-95 transition-all"
        >
          + Defecto / NCR
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3">
        <QualityMetric
          label="Defectos abiertos"
          value={incidents.length}
          tone={incidents.length ? "red" : "green"}
        />
        <QualityMetric
          label="Bloqueos"
          value={blocking}
          tone={blocking ? "red" : "green"}
        />
        <QualityMetric
          label="Scrap"
          value={scrap}
          tone={scrap ? "amber" : "green"}
        />
        <QualityMetric
          label="Retrabajo"
          value={rework}
          tone={rework ? "amber" : "green"}
        />
        <QualityMetric
          label="Evidencias"
          value={evidenceReady}
          tone={evidenceReady ? "green" : "neutral"}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <QualityChecklistItem
          done={incidents.length > 0}
          label="Defecto clasificado"
        />
        <QualityChecklistItem
          done={evidenceReady > 0}
          label="Comentario / evidencia capturada"
        />
        <QualityChecklistItem
          done={blocking === 0}
          label="Flujo liberado o NCR bloqueante visible"
        />
      </div>
    </aside>
  );
}

function QualityMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "green" | "amber" | "red" | "neutral";
}) {
  const color =
    tone === "green"
      ? GREEN
      : tone === "amber"
        ? AMBER
        : tone === "red"
          ? RED
          : GRAY;
  return (
    <div className="rounded-3xl bg-white/5 p-4 border border-white/10">
      <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">
        {label}
      </div>
      <div className="mt-2 text-3xl font-black tabular-nums" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function QualityChecklistItem({
  done,
  label,
}: {
  done: boolean;
  label: string;
}) {
  return (
    <div
      className={`rounded-2xl px-3 py-2 font-bold flex items-center gap-2 ${done ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}
    >
      {done ? (
        <CheckCircle2 className="w-4 h-4" />
      ) : (
        <AlertTriangle className="w-4 h-4" />
      )}
      {label}
    </div>
  );
}

function IncidentRow({ i, refresh }: { i: Incident; refresh: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();
  async function disposition(d: "rework" | "scrap" | "use_as_is") {
    setBusy(d);
    try {
      const res = await apiFetch(
        `${API_BASE}/mes/incidents/${i.id}/disposition`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ disposition: d }),
        },
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        toast.error(
          typeof j.message === "string"
            ? j.message
            : "No se pudo registrar la disposición.",
          "Calidad",
        );
        return;
      }
      refresh();
    } catch {
      toast.error("No se pudo contactar el backend.", "Calidad");
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
        {(["rework", "scrap", "use_as_is"] as const).map((d) => (
          <button
            key={d}
            onClick={() => disposition(d)}
            disabled={!!busy}
            className="flex-1 text-xs font-semibold px-3 py-2 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 active:scale-95 transition-all disabled:opacity-50"
          >
            {busy === d ? (
              <Loader2 className="w-4 h-4 animate-spin mx-auto" />
            ) : d === "rework" ? (
              "Retrabajo"
            ) : d === "scrap" ? (
              "Scrap"
            ) : (
              "Usar como está"
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
      className="fixed inset-0 z-[115] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-6"
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
  const [serial, setSerial] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scanner = useIndustrialScanner((scan) => {
    if (["serial", "qr", "datamatrix", "code128"].includes(scan.kind)) {
      setSerial(scan.normalized);
      setError(null);
    } else {
      setError(`${scan.message} Se esperaba serial, QR, DataMatrix o Code128.`);
    }
  });

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch(
        `${API_BASE}/mes/executions/${board.execution.id}/steps/${step.stepId}/confirm`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
        setError(
          typeof j.message === "string" ? j.message : "No se pudo confirmar.",
        );
        return;
      }
      onDone();
    } catch {
      setError("No se pudo contactar el backend.");
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
          setValue={setQty}
          min={0}
          max={max}
        />
        <Stepper
          label="Scrap (merma)"
          value={scrap}
          setValue={setScrap}
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
            onChange={(e) => setSerial(e.target.value)}
            placeholder="SN-…"
            className="mt-1 w-full bg-gray-100 dark:bg-white/5 rounded-2xl px-4 py-3 font-mono outline-none"
          />
        </div>
        <p className="text-[11px] text-gray-400">
          Disponible de la estación previa: {step.maxConfirmable} u. Al
          confirmar se descuenta el material del paso (backflush).
        </p>
        {error && <p className="text-sm text-rose-500">{error}</p>}
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
          Confirmar {qty} u{scrap > 0 ? ` · ${scrap} scrap` : ""}
        </button>
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
  onDone,
}: {
  board: Board;
  operator: string;
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
    setBusy(true);
    try {
      const res = await apiFetch(
        `${API_BASE}/mes/executions/${board.execution.id}/steps/${step.stepId}/incidents`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type,
            severity,
            qtyAffected: qty,
            blocksFlow: blocks,
            description: evidence || undefined,
            operator,
          }),
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
      toast.error("No se pudo contactar el backend.", "Calidad");
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

const ANDON_TYPES: {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
}[] = [
  {
    id: "material",
    label: "Materiales",
    icon: <Package className="w-6 h-6" />,
    color: AMBER,
  },
  {
    id: "quality",
    label: "Calidad",
    icon: <ShieldAlert className="w-6 h-6" />,
    color: "#fb7185",
  },
  {
    id: "supervisor",
    label: "Supervisor",
    icon: <Users className="w-6 h-6" />,
    color: "#a78bfa",
  },
  {
    id: "materialist",
    label: "Materialista",
    icon: <Truck className="w-6 h-6" />,
    color: AMBER,
  },
  {
    id: "maintenance",
    label: "Mantto",
    icon: <Wrench className="w-6 h-6" />,
    color: "#60a5fa",
  },
  {
    id: "engineering",
    label: "Ingeniería",
    icon: <HelpCircle className="w-6 h-6" />,
    color: "#22d3ee",
  },
  {
    id: "tooling",
    label: "Tooling",
    icon: <Hammer className="w-6 h-6" />,
    color: "#f97316",
  },
  {
    id: "stop",
    label: "Paro de línea",
    icon: <Hand className="w-6 h-6" />,
    color: RED,
  },
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
      const res = await apiFetch(
        `${API_BASE}/mes/executions/${board.execution.id}/andon`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type,
            stepId: board.currentStep?.stepId,
            raisedBy: operator,
          }),
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
      toast.error("No se pudo contactar el backend.", "Andon");
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
            {busy === a.id ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              a.icon
            )}
            <span className="font-bold text-sm">{a.label}</span>
          </button>
        ))}
      </div>
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
