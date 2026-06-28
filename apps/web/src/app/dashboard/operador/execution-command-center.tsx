import { useState } from "react";
import { useToast } from "@/contexts/ToastContext";
import { apiFetch } from "@/lib/apiFetch";
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
  responseRole?: string | null;
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

interface CommandCenterGenealogy {
  serial: string;
  model: string | null;
  woId: string | null;
  woFolio: string | null;
  componentCount: number;
  parts: {
    part: string;
    totalQty: number;
    lots: string[];
    reels: string[];
    consumptions: {
      lot: string | null;
      reel: string | null;
      qty: number;
      station: string | null;
      operator: string | null;
      consumedAt: string | null;
      source: string;
    }[];
  }[];
  lotCaptureGap: boolean;
  firstBuiltAt: string | null;
  lastBuiltAt: string | null;
}

interface ContainmentIncidentDraft {
  type: string;
  severity: string;
  blocksFlow: boolean;
  quickNcr: boolean;
  description: string;
  containment?: {
    lot?: string | null;
    serialCount?: number;
    shipmentCount?: number;
    customers?: string[];
  };
}

interface CommandCenterWhereUsed {
  query: { lot: string | null; reel: string | null; part: string | null };
  serialCount: number;
  affectedSerials: {
    serial: string;
    part: string;
    lot: string | null;
    reel: string | null;
    qty: number;
  }[];
  shipmentCount: number;
  shipments: {
    serial: string;
    shipmentId: string;
    customer: string | null;
    shippedAt: string | null;
  }[];
  recallScope: { serials: string[]; shipments: string[]; customers: string[] };
}

interface CommandCenterTraceEvent {
  id: number;
  executionStepId: number;
  stepId: number | null;
  stepName: string | null;
  quantity: number;
  scrapQty: number;
  operator: string | null;
  operatorPosition: string | null;
  serial: string | null;
  lot: string | null;
  clientRequestId: string | null;
  notes: string | null;
  timestamp: string;
  revertedAt: string | null;
  revertedReason: string | null;
  traceable: boolean;
}

export interface OperatorLedgerEvent {
  id: string | number;
  eventType?: string;
  action?: string;
  type?: string;
  referenceId?: string | null;
  message?: string | null;
  actor?: string | null;
  createdAt?: string;
  occurredAt?: string;
  metadata?: {
    ncrId?: string | null;
    escalatedTo?: string | null;
    containment?: {
      lot?: string | null;
      serialCount?: number;
      shipmentCount?: number;
      customers?: string[];
    } | null;
  } | null;
}

interface CommandCenterBoard {
  execution: {
    id: number;
    workOrder: string;
    model: string;
    revision: string;
    line: number | null;
  };
  currentStepDetail: { openIncidents: CommandCenterIncident[] } | null;
  andons: CommandCenterAndon[];
  openDowntime: CommandCenterDowntime[];
  materialRequests: { id: number; status: string; note?: string | null }[];
  recentEvents: CommandCenterTraceEvent[];
}

const AMBER = "#f59e0b";
const RED = "#ef4444";

export function ExecutionCommandCenter({
  board,
  refresh,
  onOpenSheet,
  offlineQueue,
  clearOfflineQueue,
  replayOfflineAction,
  replayOfflineQueue,
  apiBase,
  ledgerEvents = [],
  asBuiltGenealogy,
  genealogySerial,
  onSelectGenealogySerial,
  whereUsedGenealogy,
  whereUsedLot,
  onSelectWhereUsedLot,
  onCreateContainmentIncident,
}: {
  board: CommandCenterBoard;
  refresh: () => void;
  onOpenSheet: (sheet: "confirm" | "incident" | "andon") => void;
  offlineQueue: OfflineAction[];
  clearOfflineQueue: () => void;
  replayOfflineAction: (action: OfflineAction) => void;
  replayOfflineQueue: () => void;
  apiBase: string;
  ledgerEvents?: OperatorLedgerEvent[];
  asBuiltGenealogy?: CommandCenterGenealogy | null;
  genealogySerial?: string | null;
  onSelectGenealogySerial?: (serial: string | null) => void;
  whereUsedGenealogy?: CommandCenterWhereUsed | null;
  whereUsedLot?: string | null;
  onSelectWhereUsedLot?: (lot: string | null) => void;
  onCreateContainmentIncident?: (draft: ContainmentIncidentDraft) => void;
}) {
  const [serialQuery, setSerialQuery] = useState(genealogySerial ?? "");
  const [lotQuery, setLotQuery] = useState(whereUsedLot ?? "");
  const [ackingFollowUp, setAckingFollowUp] = useState<string | null>(null);
  const [escalatingFollowUp, setEscalatingFollowUp] = useState<string | null>(null);
  const toast = useToast();
  const activeAndons = board.andons.filter(
    (andon) => andon.status !== "resolved",
  );
  const timeline = [
    ...activeAndons.map((andon) => ({
      id: `andon-${andon.id}`,
      at: andon.createdAt,
      label: `Andon ${andon.type}`,
      detail: andon.responseRole
        ? `${andon.status} · ${andon.responseRole}${andon.note ? ` · ${andon.note}` : ""}`
        : andon.note || andon.status,
      tone: "red" as const,
      source: "containment" as const,
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
      source: "andon" as const,
    })),
    ...board.recentEvents.map((event) => ({
      id: `trace-${event.id}`,
      at: event.timestamp,
      label: `Confirmación · ${event.stepName ?? "Estación"}`,
      detail: [
        `${event.quantity}u buenas`,
        event.scrapQty ? `${event.scrapQty} scrap` : null,
        event.serial ? `SN ${event.serial}` : null,
        event.lot ? `Lote ${event.lot}` : null,
        event.operator ?? null,
      ]
        .filter(Boolean)
        .join(" · "),
      tone: event.revertedAt ? ("amber" as const) : ("green" as const),
    })),
    ...ledgerEvents.map((event) => ({
      id: `ledger-${event.id}`,
      at: event.createdAt ?? event.occurredAt ?? new Date().toISOString(),
      label: `Ledger · ${event.eventType ?? event.action ?? event.type ?? "EVENT"}`,
      detail: event.message ?? event.actor ?? "auditado",
      tone: "green" as const,
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const containmentByLot = ledgerEvents.reduce<
    {
      lot: string;
      serialCount: number;
      shipmentCount: number;
      customers: string[];
      ncrId: string | null;
      at: string;
    }[]
  >((acc, event) => {
    const containment = event.metadata?.containment;
    const lot = containment?.lot?.trim();
    if (!lot) return acc;
    const existing = acc.find((item) => item.lot === lot);
    if (existing) {
      existing.serialCount = Math.max(
        existing.serialCount,
        containment?.serialCount ?? 0,
      );
      existing.shipmentCount = Math.max(
        existing.shipmentCount,
        containment?.shipmentCount ?? 0,
      );
      existing.customers = Array.from(
        new Set([
          ...existing.customers,
          ...(containment?.customers ?? []),
        ]),
      );
      return acc;
    }
    acc.push({
      lot,
      serialCount: containment?.serialCount ?? 0,
      shipmentCount: containment?.shipmentCount ?? 0,
      customers: containment?.customers ?? [],
      ncrId: event.metadata?.ncrId ?? null,
      at: event.createdAt ?? event.occurredAt ?? new Date().toISOString(),
    });
    return acc;
  }, []);

  const followUpAuditByKey = ledgerEvents.reduce<
    Record<
      string,
      { acknowledged: boolean; escalatedTo: string | null; updatedAt: string }
    >
  >((acc, event) => {
    const action = event.action ?? event.eventType ?? event.type;
    if (
      action !== "MES_FOLLOW_UP_ACK" &&
      action !== "MES_FOLLOW_UP_ESCALATED"
    ) {
      return acc;
    }
    const key = event.referenceId;
    if (!key) return acc;
    const current = acc[key] ?? {
      acknowledged: false,
      escalatedTo: null,
      updatedAt: event.createdAt ?? event.occurredAt ?? new Date().toISOString(),
    };
    acc[key] = {
      acknowledged: current.acknowledged || action === "MES_FOLLOW_UP_ACK",
      escalatedTo:
        action === "MES_FOLLOW_UP_ESCALATED"
          ? (event.metadata?.escalatedTo ?? "Escalado")
          : current.escalatedTo,
      updatedAt: event.createdAt ?? event.occurredAt ?? current.updatedAt,
    };
    return acc;
  }, {});

  const followUpTasks = [
    ...containmentByLot.map((item) => ({
      id: `containment-${item.lot}`,
      label: `Contención lote ${item.lot}`,
      owner: "Calidad",
      sla: item.shipmentCount ? "15m crítico" : "30m",
      status: item.ncrId ?? "NCR pendiente",
      tone: "red" as const,
      source: "containment" as const,
    })),
    ...activeAndons.map((andon) => ({
      id: `andon-follow-${andon.id}`,
      label: `Andon ${andon.type}`,
      owner: andon.responseRole ?? "Soporte",
      sla: "<5m",
      status: andon.status,
      tone: "amber" as const,
      source: "andon" as const,
    })),
    ...board.materialRequests.map((request) => ({
      id: `material-follow-${request.id}`,
      label: `Kanban material #${request.id}`,
      owner: "Materialista",
      sla: "20m",
      status: request.status,
      tone: "amber" as const,
      source: "material" as const,
    })),
  ]
    .map((task) => ({
      ...task,
      audit: followUpAuditByKey[task.id] ?? null,
    }))
    .slice(0, 6);

  function escalationOwner(task: (typeof followUpTasks)[number]) {
    if (task.source === "containment") return "Calidad Sr";
    if (task.source === "material") return "Coordinador material";
    return "Supervisor";
  }

  async function acknowledgeFollowUp(task: (typeof followUpTasks)[number]) {
    setAckingFollowUp(task.id);
    try {
      const res = await apiFetch(`${apiBase}/mes/follow-ups/ack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          executionId: board.execution.id,
          followUpKey: task.id,
          label: task.label,
          owner: task.owner,
          source: task.source,
          status: task.status,
          note: `ACK desde terminal operador · SLA ${task.sla}`,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Follow-up reconocido y auditado.", "Seguimiento SLA");
      refresh();
    } catch {
      toast.error("No se pudo reconocer el follow-up.", "Seguimiento SLA");
    } finally {
      setAckingFollowUp(null);
    }
  }

  async function escalateFollowUp(task: (typeof followUpTasks)[number]) {
    setEscalatingFollowUp(task.id);
    try {
      const escalatedTo = escalationOwner(task);
      const res = await apiFetch(`${apiBase}/mes/follow-ups/escalate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          executionId: board.execution.id,
          followUpKey: task.id,
          label: task.label,
          owner: task.owner,
          escalatedTo,
          source: task.source,
          reason: `Escalación SLA desde terminal operador · ${task.sla}`,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(`Follow-up escalado a ${escalatedTo}.`, "Seguimiento SLA");
      refresh();
    } catch {
      toast.error("No se pudo escalar el follow-up.", "Seguimiento SLA");
    } finally {
      setEscalatingFollowUp(null);
    }
  }

  const traceableEvents = board.recentEvents
    .filter((event) => event.serial || event.lot)
    .slice(0, 4);
  const lastTrace = traceableEvents[0] ?? board.recentEvents[0] ?? null;
  const genealogyNodes = [
    { label: "WO", value: board.execution.workOrder },
    { label: "Último SN", value: lastTrace?.serial ?? "—" },
    { label: "Último lote", value: lastTrace?.lot ?? "—" },
    {
      label: "Componentes",
      value: asBuiltGenealogy ? String(asBuiltGenealogy.componentCount) : "—",
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
            Activos: {activeAndons.length || 0} · routing visible para supervisor,
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
          <form
            className="mt-3 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const nextSerial = serialQuery.trim();
              onSelectGenealogySerial?.(nextSerial || null);
            }}
          >
            <input
              value={serialQuery}
              onChange={(event) => setSerialQuery(event.target.value)}
              placeholder={genealogySerial || "Buscar serial as-built"}
              className="min-h-11 flex-1 rounded-2xl border border-white/10 bg-white/5 px-3 text-xs font-black outline-none focus:border-sky-400"
            />
            <button
              type="submit"
              className="min-h-11 rounded-2xl bg-sky-500/10 px-3 text-xs font-black text-sky-500"
            >
              Trazar
            </button>
          </form>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const nextLot = lotQuery.trim();
              onSelectWhereUsedLot?.(nextLot || null);
            }}
          >
            <input
              value={lotQuery}
              onChange={(event) => setLotQuery(event.target.value)}
              placeholder={whereUsedLot || "Contención por lote"}
              className="min-h-11 flex-1 rounded-2xl border border-white/10 bg-white/5 px-3 text-xs font-black outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              className="min-h-11 rounded-2xl bg-amber-500/10 px-3 text-xs font-black text-amber-500"
            >
              Where-used
            </button>
          </form>
          <div className="mt-3 space-y-2">
            {containmentByLot.length > 0 && (
              <div className="rounded-2xl bg-rose-500/10 px-3 py-2 text-xs">
                <div className="font-black text-rose-500">
                  NCR / contención auditada
                </div>
                <div className="mt-2 grid grid-cols-1 gap-1">
                  {containmentByLot.slice(0, 3).map((item) => (
                    <div key={item.lot} className="rounded-xl bg-white/5 px-2 py-1">
                      <span className="font-mono font-black">{item.lot}</span> ·
                      {" "}{item.serialCount} serial(es) · {item.shipmentCount}
                      embarque(s) · {item.ncrId ?? "NCR pendiente"}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {whereUsedGenealogy && (
              <div className="rounded-2xl bg-amber-500/10 px-3 py-2 text-xs">
                <div className="flex items-center gap-2 font-black text-amber-500">
                  <span>
                    Contención lote · {whereUsedGenealogy.query.lot ?? "—"}
                  </span>
                  <span className="ml-auto">
                    {whereUsedGenealogy.serialCount} serial(es)
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-gray-500">
                  Embarques: {whereUsedGenealogy.shipmentCount} · clientes:{" "}
                  {whereUsedGenealogy.recallScope.customers.join(", ") || "—"}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onCreateContainmentIncident?.({
                      type: "Material sospechoso",
                      severity: whereUsedGenealogy.shipmentCount
                        ? "critical"
                        : "high",
                      blocksFlow: true,
                      quickNcr: true,
                      description: [
                        `Contención where-used desde terminal.`,
                        `Lote: ${whereUsedGenealogy.query.lot ?? "—"}`,
                        `Seriales afectados: ${whereUsedGenealogy.serialCount}`,
                        `Embarques: ${whereUsedGenealogy.shipmentCount}`,
                        `Clientes: ${
                          whereUsedGenealogy.recallScope.customers.join(", ") ||
                          "—"
                        }`,
                      ].join("\n"),
                      containment: {
                        lot: whereUsedGenealogy.query.lot,
                        serialCount: whereUsedGenealogy.serialCount,
                        shipmentCount: whereUsedGenealogy.shipmentCount,
                        customers: whereUsedGenealogy.recallScope.customers,
                      },
                    })
                  }
                  className="mt-2 w-full rounded-xl bg-rose-500/10 px-3 py-2 text-left text-[11px] font-black text-rose-500 hover:bg-rose-500/15"
                >
                  Crear NCR / hold por contención
                </button>
                <div className="mt-2 grid grid-cols-1 gap-1">
                  {whereUsedGenealogy.affectedSerials.slice(0, 3).map((row) => (
                    <button
                      key={`${row.serial}-${row.part}-${row.lot ?? "lot"}`}
                      type="button"
                      onClick={() => onSelectGenealogySerial?.(row.serial)}
                      className="rounded-xl bg-white/5 px-2 py-1 text-left text-[11px] hover:bg-white/10"
                    >
                      <span className="font-mono font-black">{row.serial}</span> ·
                      {" "}{row.part} · {row.qty}u
                    </button>
                  ))}
                </div>
              </div>
            )}
            {asBuiltGenealogy && (
              <div className="rounded-2xl bg-sky-500/10 px-3 py-2 text-xs">
                <div className="flex items-center gap-2 font-black text-sky-500">
                  <span>Árbol as-built · {asBuiltGenealogy.serial}</span>
                  <span className="ml-auto">
                    {asBuiltGenealogy.lotCaptureGap ? "Gap lote" : "Lotes OK"}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-1 gap-1">
                  {asBuiltGenealogy.parts.slice(0, 3).map((part) => (
                    <div
                      key={part.part}
                      className="rounded-xl bg-white/5 px-2 py-1 text-[11px]"
                    >
                      <span className="font-mono font-black">{part.part}</span> ·
                      {" "}{part.totalQty}u · lotes {part.lots.join(", ") || "—"}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {traceableEvents.length ? (
              traceableEvents.map((event) => (
                <div
                  key={event.id}
                  className="rounded-2xl bg-emerald-500/10 px-3 py-2 text-xs"
                >
                  <div className="flex items-center gap-2 font-black text-emerald-600">
                    <span>{event.stepName ?? "Estación"}</span>
                    <span className="ml-auto font-mono">#{event.id}</span>
                  </div>
                  <div className="mt-1 text-gray-500">
                    {event.serial ? `SN ${event.serial}` : "Sin serial"}
                    {event.lot ? ` · Lote ${event.lot}` : ""} · {event.quantity}
                    u buenas{event.scrapQty ? ` · ${event.scrapQty} scrap` : ""}
                  </div>
                  <div className="mt-1 text-[10px] text-gray-500">
                    {event.operator ?? "Operador no capturado"}
                    {event.clientRequestId ? ` · ${event.clientRequestId}` : ""}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl bg-white/5 px-3 py-2 text-xs text-gray-500">
                Sin serial/lote capturado aún. Escanea el serial o lote al
                confirmar avance para alimentar genealogía y auditoría.
              </div>
            )}
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
                      backgroundColor:
                        item.tone === "red"
                          ? RED
                          : item.tone === "green"
                            ? "#10b981"
                            : AMBER,
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
            <div className="rounded-2xl bg-white/5 p-3">
              <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-500">
                Seguimiento SLA
              </div>
              {followUpTasks.length ? (
                <div className="space-y-1.5">
                  {followUpTasks.map((task) => (
                    <div
                      key={task.id}
                      className="rounded-xl bg-white/5 px-2 py-1.5 text-[11px]"
                    >
                      <div className="flex items-center gap-2 font-black">
                        <span>{task.label}</span>
                        <span
                          className={`ml-auto ${
                            task.tone === "red"
                              ? "text-rose-500"
                              : "text-amber-500"
                          }`}
                        >
                          {task.sla}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-500">
                        <span>
                          Owner {task.owner} · {task.audit?.escalatedTo ?? task.status}
                          {task.audit?.acknowledged ? " · ACK" : ""}
                        </span>
                        <span className="ml-auto flex gap-1">
                          <button
                            type="button"
                            onClick={() => acknowledgeFollowUp(task)}
                            disabled={ackingFollowUp === task.id || task.audit?.acknowledged}
                            className="rounded-lg bg-white/10 px-2 py-0.5 text-[10px] font-black text-gray-400 hover:bg-white/15 disabled:opacity-50"
                          >
                            {ackingFollowUp === task.id ? "ACK…" : "ACK"}
                          </button>
                          <button
                            type="button"
                            onClick={() => escalateFollowUp(task)}
                            disabled={
                              escalatingFollowUp === task.id ||
                              !!task.audit?.escalatedTo
                            }
                            className="rounded-lg bg-amber-500/10 px-2 py-0.5 text-[10px] font-black text-amber-500 hover:bg-amber-500/15 disabled:opacity-50"
                          >
                            {escalatingFollowUp === task.id ? "ESC…" : "ESC"}
                          </button>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl bg-emerald-500/10 px-2 py-1.5 text-[11px] font-bold text-emerald-600">
                  Sin follow-ups críticos abiertos.
                </div>
              )}
            </div>
            <div className="rounded-2xl bg-amber-500/10 p-3 text-amber-600 font-bold flex items-center gap-2">
              <WifiOff className="w-4 h-4" /> Cola local: {offlineQueue.length}{" "}
              pendiente(s)
            </div>
            {offlineQueue.slice(0, 3).map((item) => (
              <button
                key={item.id}
                onClick={() => replayOfflineAction(item)}
                className="w-full rounded-2xl bg-white/5 px-3 py-2 text-left text-[11px] font-bold hover:bg-white/10"
              >
                {item.label} · intentos {item.attempts}
                {item.lastError ? ` · ${item.lastError}` : ""}
              </button>
            ))}
            {offlineQueue.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={replayOfflineQueue}
                  className="rounded-2xl bg-emerald-500/10 px-3 py-2 text-[11px] font-black text-emerald-600"
                >
                  Sync servidor
                </button>
                <button
                  onClick={clearOfflineQueue}
                  className="rounded-2xl bg-rose-500/10 px-3 py-2 text-[11px] font-black text-rose-500"
                >
                  Limpiar cola
                </button>
              </div>
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
