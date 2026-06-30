import {
  Bell,
  GitBranch,
  Keyboard,
  ListChecks,
  RefreshCw,
  Truck,
  WifiOff,
  Zap,
} from "lucide-react";
import { glass } from "@/lib/glass";
import type { OfflineAction } from "./operator-terminal.utils";
import { ANDON_TYPES } from "./andon-types";

interface CommandCenterAndon {
  id: number;
  type: string;
  status: string;
  note: string | null;
  createdAt: string;
}

interface CommandCenterIncident {
  id: number;
  type: string;
  severity: string;
  disposition: string | null;
  blocksFlow: boolean;
  createdAt: string;
}

interface CommandCenterDowntime {
  id: number;
  reason: string;
  startedAt: string;
  endedAt: string | null;
}

interface CommandCenterBoard {
  execution: {
    workOrder: string;
    model: string;
    revision: string;
    line: number | null;
  };
  currentStepDetail: { openIncidents: CommandCenterIncident[] } | null;
  andons: CommandCenterAndon[];
  openDowntime: CommandCenterDowntime[];
  materialRequests: { id: number; status: string; note?: string | null }[];
}

type OperatorSheet = "confirm" | "incident" | "andon" | "material";

const AMBER = "#f59e0b";
const RED = "#ef4444";

export function ExecutionCommandCenter({
  board,
  refresh,
  onOpenSheet,
  offlineQueue,
  clearOfflineQueue,
  markOfflineAttempt,
}: {
  board: CommandCenterBoard;
  refresh: () => void;
  onOpenSheet: (sheet: OperatorSheet) => void;
  offlineQueue: OfflineAction[];
  clearOfflineQueue: () => void;
  markOfflineAttempt: (id: string) => void;
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
          <button
            onClick={() => onOpenSheet("material")}
            className="mb-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-amber-700 text-sm font-black text-white transition-all hover:bg-amber-800 active:scale-[0.98]"
          >
            <Truck className="h-4 w-4" /> F4 Solicitar material
          </button>
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
          <div className="mt-3 space-y-2 text-xs">
            <div className="rounded-2xl bg-amber-500/10 p-3 text-amber-600 font-bold flex items-center gap-2">
              <WifiOff className="w-4 h-4" /> Cola local: {offlineQueue.length}{" "}
              pendiente(s)
            </div>
            {offlineQueue.slice(0, 3).map((item) => (
              <button
                key={item.id}
                onClick={() => markOfflineAttempt(item.id)}
                className="w-full rounded-2xl bg-white/5 px-3 py-2 text-left text-[11px] font-bold hover:bg-white/10"
              >
                {item.label} · intentos {item.attempts}
              </button>
            ))}
            {offlineQueue.length > 0 && (
              <button
                onClick={clearOfflineQueue}
                className="w-full rounded-2xl bg-rose-500/10 px-3 py-2 text-[11px] font-black text-rose-500"
              >
                Limpiar cola local
              </button>
            )}
            <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-600 font-bold flex items-center gap-2">
              <Zap className="w-4 h-4" /> UI &lt;100ms objetivo · preferencias
              persistidas
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
