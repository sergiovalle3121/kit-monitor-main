"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2, Lock, Inbox, Search, ArrowDownLeft, ArrowUpRight, ArrowLeftRight,
  SlidersHorizontal, Repeat, AlertTriangle, ChevronRight, GitBranch, MapPin,
  PackageSearch, ClipboardCheck, X,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { glass } from "@/lib/glass";
import { useApi } from "@/hooks/useApi";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/contexts/ToastContext";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000").replace(/\/$/, "");

// ── Tipos espejo del backend ────────────────────────────────────────────────
interface Position {
  id: number | string;
  partNumber: string;
  location?: string; // rack/bin/zona (default 'BULK')
  warehouseId?: string | null;
  warehouse?: { name?: string; code?: string } | null;
  material?: { description?: string | null; uom?: string | null } | null;
  onHand?: number;
  allocated?: number;
  inTransit?: number;
  holdStatus?: string;
  lotNumber?: string | null;
  serialNumber?: string | null;
}

// Espejo de InventoryTransactionType del backend (inventory-movement.entity.ts).
type MovementType =
  | "RECEIVE" | "TRANSFER" | "PUTAWAY" | "ISSUE" | "RETURN" | "ADJUST"
  | "RESUPPLY" | "CONSUME" | "HOLD" | "RELEASE" | "SCRAP";

interface Movement {
  id: number | string;
  partNumber: string;
  type: MovementType;
  quantity: number;
  fromWarehouseId?: string | null;
  toWarehouseId?: string | null;
  fromLocation?: string | null;
  toLocation?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  actorName?: string | null;
  reason?: string | null;
  createdAt?: string | null;
}

// Regla de resurtido min-max (replenishment_rules).
interface ReplenRule {
  id: number | string;
  partNumber: string;
  warehouseId?: string | null;
  minStock?: number;
  maxStock?: number;
  safetyStock?: number;
  priority?: string;
  isActive?: boolean;
}

// Línea de surtido (sf_staging) — fuente de la demanda de WO.
interface StagingLine {
  id: string;
  woId: string;
  woFolio: string | null;
  model: string;
  station: string;
  part: string;
  requiredQty: number;
  stagedQty: number;
  status: "PENDING" | "STAGED" | "SHORTAGE";
}

// Evento de consumo (sf_consumption_events) — genealogía where-used.
interface ConsumptionEvent {
  id: string;
  woId: string;
  woFolio: string | null;
  model: string;
  station: string;
  part: string | null;
  units: number;
  backflushQty: number;
  unitSerial: string | null;
  operatorEmail: string | null;
  createdAt?: string | null;
}

interface CycleCountDiscrepancyItem {
  id: string;
  folio: string | null;
  partNumber: string;
  location: string | null;
  programId: string | null;
  uom: string;
  systemQty: number;
  countedQty: number;
  variance: number;
  absVariance: number;
  relativeVariancePct: number | null;
  direction: "SHORTAGE" | "OVERAGE";
  severity: "LOW" | "MEDIUM" | "HIGH";
  recommendedAction: "INVESTIGATE_SHORTAGE" | "RECONCILE_OVERAGE";
  countedBy: string | null;
  countedAt: string | null;
}

interface CycleCountDiscrepancyMonitor {
  generatedAt: string;
  summary: {
    total: number;
    high: number;
    medium: number;
    low: number;
    shortages: number;
    overages: number;
    totalAbsVariance: number;
    netVariance: number;
  };
  items: CycleCountDiscrepancyItem[];
}

const HOLD_META: Record<string, { label: string; color: string }> = {
  available: { label: "Disponible", color: "#16a394" },
  hold: { label: "Retenido", color: "#f59e0b" },
  quarantine: { label: "Cuarentena", color: "#ef4444" },
  expired: { label: "Caducado", color: "#ef4444" },
  pending_iqc: { label: "IQC pend.", color: "#f59e0b" },
  pending_oqc: { label: "OQC pend.", color: "#f59e0b" },
  staged_for_shipping: { label: "Para embarque", color: "#0a84ff" },
  shipped: { label: "Embarcado", color: "#6b7280" },
};

// Dirección del movimiento sobre el stock: entrada (+), salida (−) o traslado (=).
const MOVE_META: Record<MovementType, { label: string; dir: "in" | "out" | "move" | "neutral"; color: string }> = {
  RECEIVE: { label: "Recibo", dir: "in", color: "#16a394" },
  RETURN: { label: "Devolución", dir: "in", color: "#16a394" },
  RELEASE: { label: "Liberación", dir: "in", color: "#16a394" },
  CONSUME: { label: "Consumo", dir: "out", color: "#ef4444" },
  ISSUE: { label: "Salida", dir: "out", color: "#ef4444" },
  SCRAP: { label: "Scrap", dir: "out", color: "#ef4444" },
  TRANSFER: { label: "Traslado", dir: "move", color: "#0a84ff" },
  PUTAWAY: { label: "Acomodo", dir: "move", color: "#0a84ff" },
  RESUPPLY: { label: "Resurtido", dir: "move", color: "#0a84ff" },
  ADJUST: { label: "Ajuste", dir: "neutral", color: "#f59e0b" },
  HOLD: { label: "Retención", dir: "neutral", color: "#f59e0b" },
};

const DISCREPANCY_SEVERITY_META: Record<CycleCountDiscrepancyItem["severity"], { label: string; color: string }> = {
  HIGH: { label: "Alta", color: "#ef4444" },
  MEDIUM: { label: "Media", color: "#f59e0b" },
  LOW: { label: "Baja", color: "#16a394" },
};

const DISCREPANCY_ACTION_LABEL: Record<CycleCountDiscrepancyItem["recommendedAction"], string> = {
  INVESTIGATE_SHORTAGE: "Investigar faltante antes de ajustar",
  RECONCILE_OVERAGE: "Revisar sobrante y conciliar",
};

const GREEN = "#16a394";
const RED = "#ef4444";
const AMBER = "#f59e0b";
const BLUE = "#0a84ff";

function fmtQty(n: number | undefined | null): string {
  const v = n ?? 0;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

function timeAgo(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return d.toLocaleDateString();
}

type Tab = "positions" | "shortage" | "discrepancies" | "movements" | "replenishment" | "traceability";

export default function InventoryPage() {
  const [tab, setTab] = useState<Tab>("positions");
  const [locationFilter, setLocationFilter] = useState("");
  const activeLocationFilter = locationFilter.trim();
  const positionsPath = useMemo(() => {
    const params = new URLSearchParams();
    if (activeLocationFilter) params.set("location", activeLocationFilter);
    const query = params.toString();
    return query ? `/inventory/positions?${query}` : "/inventory/positions";
  }, [activeLocationFilter]);
  const { data, isLoading, forbidden } = useApi<Position[]>(positionsPath);
  // El ledger de movimientos solo se pide cuando la pestaña está activa.
  const { data: movData, isLoading: movLoading, forbidden: movForbidden } =
    useApi<Movement[]>(tab === "movements" ? "/inventory/movements" : null);
  // Reglas de resurtido (min/máx) — para Resurtido y para la vista de Escasez.
  const { data: ruleData, isLoading: ruleLoading, forbidden: ruleForbidden } =
    useApi<ReplenRule[]>(tab === "replenishment" || tab === "shortage" ? "/replenishment/rules" : null);
  // Demanda real: líneas de surtido de las WO (solo al ver Escasez).
  const { data: stagingData, isLoading: stagingLoading } =
    useApi<StagingLine[]>(tab === "shortage" ? "/material-staging" : null);
  const { data: discrepancyData, isLoading: discrepancyLoading, forbidden: discrepancyForbidden } =
    useApi<CycleCountDiscrepancyMonitor>(tab === "discrepancies" ? "/cycle-counts/discrepancies?limit=25" : null);

  const [q, setQ] = useState("");
  const [tracePart, setTracePart] = useState("");
  const toast = useToast();
  const [busyCount, setBusyCount] = useState<string | number | null>(null);

  // Saltos entre pestañas para operar el flujo (escasez → existencias → traza).
  const goPositions = (part: string) => { setQ(part); setTab("positions"); };
  const goTrace = (part: string) => { setTracePart(part); setTab("traceability"); };

  // Lanza un conteo cíclico de un bin desde existencias (cierra el loop con Conteos).
  async function countBin(p: Position, uom: string) {
    setBusyCount(p.id);
    try {
      const res = await apiFetch(`${API_BASE}/cycle-counts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partNumber: p.partNumber,
          location: p.location || undefined,
          systemQty: Number(p.onHand ?? 0),
          uom: uom || "PCS",
        }),
      });
      if (!res.ok) { toast.error("No se pudo crear el conteo.", "Inventario"); return; }
      toast.success(`Conteo creado: ${p.partNumber}${p.location ? ` @ ${p.location}` : ""} → revísalo en Conteos Cíclicos.`, "Inventario");
    } catch {
      toast.error("Error de red.", "Inventario");
    } finally {
      setBusyCount(null);
    }
  }

  const positions = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const movements = useMemo(() => (Array.isArray(movData) ? movData : []), [movData]);
  const rules = useMemo(() => (Array.isArray(ruleData) ? ruleData : []), [ruleData]);
  const staging = useMemo(() => (Array.isArray(stagingData) ? stagingData : []), [stagingData]);
  const discrepancyItems = useMemo(
    () => (Array.isArray(discrepancyData?.items) ? discrepancyData.items : []),
    [discrepancyData],
  );

  // ── Existencias agrupadas por parte (con detalle por ubicación) ─────────────
  const partGroups = useMemo(() => {
    const map = new Map<string, {
      partNumber: string; description: string; uom: string;
      onHand: number; allocated: number; available: number;
      rows: Position[];
    }>();
    for (const p of positions) {
      const key = p.partNumber;
      const onHand = Number(p.onHand ?? 0);
      const allocated = Number(p.allocated ?? 0);
      const g = map.get(key) ?? {
        partNumber: key,
        description: p.material?.description ?? "",
        uom: p.material?.uom ?? "",
        onHand: 0, allocated: 0, available: 0, rows: [],
      };
      g.onHand += onHand;
      g.allocated += allocated;
      g.available += onHand - allocated;
      if (!g.description && p.material?.description) g.description = p.material.description;
      if (!g.uom && p.material?.uom) g.uom = p.material.uom;
      g.rows.push(p);
      map.set(key, g);
    }
    const arr = Array.from(map.values()).sort((a, b) => a.partNumber.localeCompare(b.partNumber));
    if (!q) return arr;
    const needle = q.toLowerCase();
    return arr.filter((g) =>
      `${g.partNumber} ${g.description} ${g.rows.map((r) => r.location ?? "").join(" ")}`.toLowerCase().includes(needle),
    );
  }, [positions, q]);

  // ── Escasez: demanda de WO (sin surtir) vs disponible en almacén + min/máx ──
  const shortageRows = useMemo(() => {
    // Demanda: líneas abiertas (PENDING/SHORTAGE) → req. aún no montado.
    const demand = new Map<string, { qty: number; wos: Set<string>; confirmed: boolean }>();
    for (const l of staging) {
      if (l.status === "STAGED") continue;
      const open = Math.max(0, Number(l.requiredQty) - Number(l.stagedQty));
      if (open <= 0 && l.status !== "SHORTAGE") continue;
      const d = demand.get(l.part) ?? { qty: 0, wos: new Set<string>(), confirmed: false };
      d.qty += open;
      if (l.woFolio || l.woId) d.wos.add(l.woFolio || l.woId);
      if (l.status === "SHORTAGE") d.confirmed = true;
      demand.set(l.part, d);
    }
    // Disponible en almacén (solo holdStatus = available).
    const avail = new Map<string, number>();
    for (const p of positions) {
      if ((p.holdStatus ?? "available") !== "available") continue;
      const a = Number(p.onHand ?? 0) - Number(p.allocated ?? 0);
      avail.set(p.partNumber, (avail.get(p.partNumber) ?? 0) + a);
    }
    // Reglas min/máx por parte (primera regla activa que matchee).
    const rule = new Map<string, ReplenRule>();
    for (const r of rules) {
      if (r.isActive === false) continue;
      if (!rule.has(r.partNumber)) rule.set(r.partNumber, r);
    }

    const parts = new Set<string>([...demand.keys(), ...rule.keys()]);
    const rows = Array.from(parts).map((part) => {
      const d = demand.get(part);
      const r = rule.get(part);
      const available = avail.get(part) ?? 0;
      const demandQty = d?.qty ?? 0;
      const shortage = Math.max(0, demandQty - available);
      const belowMin = r != null && typeof r.minStock === "number" && available <= r.minStock;
      return {
        part,
        demandQty,
        available,
        shortage,
        belowMin,
        confirmed: d?.confirmed ?? false,
        wos: d ? Array.from(d.wos) : [],
        rule: r,
      };
    });
    // Solo filas accionables: con faltante, bajo mínimo, o faltante confirmado en línea.
    const actionable = rows.filter((r) => r.shortage > 0 || r.belowMin || r.confirmed);
    actionable.sort((a, b) => {
      if (a.confirmed !== b.confirmed) return a.confirmed ? -1 : 1;
      if (b.shortage !== a.shortage) return b.shortage - a.shortage;
      return Number(b.belowMin) - Number(a.belowMin);
    });
    if (!q) return actionable;
    const needle = q.toLowerCase();
    return actionable.filter((r) => `${r.part} ${r.wos.join(" ")}`.toLowerCase().includes(needle));
  }, [staging, positions, rules, q]);

  const shortageKpis = useMemo(() => ({
    parts: shortageRows.length,
    totalShort: shortageRows.reduce((a, r) => a + r.shortage, 0),
    belowMin: shortageRows.filter((r) => r.belowMin).length,
    confirmed: shortageRows.filter((r) => r.confirmed).length,
  }), [shortageRows]);

  const discrepancyRows = useMemo(() => {
    if (!q) return discrepancyItems;
    const needle = q.toLowerCase();
    return discrepancyItems.filter((item) =>
      `${item.partNumber} ${item.folio ?? ""} ${item.location ?? ""} ${item.countedBy ?? ""}`.toLowerCase().includes(needle),
    );
  }, [discrepancyItems, q]);

  const discrepancySummary = useMemo(() => ({
    total: discrepancyRows.length,
    high: discrepancyRows.filter((item) => item.severity === "HIGH").length,
    shortages: discrepancyRows.filter((item) => item.direction === "SHORTAGE").length,
    overages: discrepancyRows.filter((item) => item.direction === "OVERAGE").length,
    totalAbsVariance: discrepancyRows.reduce((sum, item) => sum + item.absVariance, 0),
    netVariance: discrepancyRows.reduce((sum, item) => sum + item.variance, 0),
  }), [discrepancyRows]);

  const movRows = q
    ? movements.filter((m) => `${m.partNumber} ${m.referenceId ?? ""} ${m.actorName ?? ""}`.toLowerCase().includes(q.toLowerCase()))
    : movements;

  // Disponible por parte+almacén (liberado) para el estado de quiebre de las reglas.
  const availByPartWh = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of positions) {
      if ((p.holdStatus ?? "available") !== "available") continue;
      const key = `${p.partNumber}|${p.warehouseId ?? ""}`;
      m.set(key, (m.get(key) ?? 0) + (Number(p.onHand ?? 0) - Number(p.allocated ?? 0)));
    }
    return m;
  }, [positions]);

  // Reglas enriquecidas con on-hand actual, quiebre (≤ min) y sugerido de reposición.
  const ruleRows = useMemo(() => {
    const base = q
      ? rules.filter((r) => `${r.partNumber} ${r.warehouseId ?? ""}`.toLowerCase().includes(q.toLowerCase()))
      : rules;
    const enriched = base.map((r) => {
      const available = availByPartWh.get(`${r.partNumber}|${r.warehouseId ?? ""}`) ?? 0;
      const belowMin = typeof r.minStock === "number" && available <= r.minStock;
      const suggested = belowMin ? Math.max(0, Number(r.maxStock ?? 0) - available) : 0;
      return { r, available, belowMin, suggested };
    });
    enriched.sort((a, b) => Number(b.belowMin) - Number(a.belowMin) || b.suggested - a.suggested);
    return enriched;
  }, [rules, q, availByPartWh]);

  // Resumen honesto del flujo recibo→consumo (derivado del ledger en vivo).
  const flow = useMemo(() => {
    let received = 0, consumed = 0;
    for (const m of movements) {
      const dir = MOVE_META[m.type]?.dir;
      if (dir === "in") received += m.quantity ?? 0;
      else if (dir === "out") consumed += m.quantity ?? 0;
    }
    return { received, consumed, total: movements.length };
  }, [movements]);

  const showSearch =
    tab === "positions" ? positions.length > 0 || Boolean(q || activeLocationFilter) :
    tab === "shortage" ? true :
    tab === "discrepancies" ? discrepancyItems.length > 0 :
    tab === "movements" ? movements.length > 0 :
    tab === "replenishment" ? rules.length > 0 : false;

  return (
    <div className="min-h-screen text-foreground font-sans pb-32">
      <main className="max-w-7xl mx-auto px-6 pt-10">
        <PageHeader domain="inventory" title="Inventario" subtitle="Existencias por ubicación, escasez vs demanda y trazabilidad" />

        {/* Pestañas */}
        <div className={`${glass} inline-flex items-center gap-1 p-1 rounded-2xl mb-5 flex-wrap`}>
          <TabBtn active={tab === "positions"} onClick={() => setTab("positions")} icon={<SlidersHorizontal className="w-4 h-4" />}>Existencias</TabBtn>
          <TabBtn active={tab === "shortage"} onClick={() => setTab("shortage")} icon={<AlertTriangle className="w-4 h-4" />}>Escasez</TabBtn>
          <TabBtn active={tab === "discrepancies"} onClick={() => setTab("discrepancies")} icon={<ClipboardCheck className="w-4 h-4" />}>Discrepancias</TabBtn>
          <TabBtn active={tab === "movements"} onClick={() => setTab("movements")} icon={<ArrowLeftRight className="w-4 h-4" />}>Movimientos</TabBtn>
          <TabBtn active={tab === "replenishment"} onClick={() => setTab("replenishment")} icon={<Repeat className="w-4 h-4" />}>Resurtido</TabBtn>
          <TabBtn active={tab === "traceability"} onClick={() => setTab("traceability")} icon={<GitBranch className="w-4 h-4" />}>Trazabilidad</TabBtn>
        </div>

        {showSearch && (
          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_18rem] mb-5">
            <div className={`${glass} flex items-center gap-2 px-4 py-2.5 rounded-2xl`}>
            <Search className="w-4 h-4 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={
                tab === "positions" ? "Buscar parte, descripción o ubicación…" :
                tab === "shortage" ? "Buscar parte o WO…" :
                tab === "movements" ? "Buscar parte, referencia u operador…" :
                "Buscar parte o almacén…"
              }
              className="bg-transparent outline-none text-sm w-full"
            />
            </div>
            {tab === "positions" && (
              <div className={`${glass} flex items-center gap-2 px-4 py-2.5 rounded-2xl`}>
                <MapPin className="w-4 h-4 text-gray-400" />
                <input
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  placeholder="Filtrar ubicacion / rack"
                  className="bg-transparent outline-none text-sm w-full font-mono"
                />
                {activeLocationFilter && (
                  <button
                    onClick={() => setLocationFilter("")}
                    title="Limpiar filtro de ubicacion"
                    className="p-1 rounded-lg text-gray-400 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {tab === "positions" && (
          forbidden ? (
            <Empty icon={<Lock className="w-6 h-6" />} title="Sin acceso al backend" body="Verifica que el servicio de API esté conectado." />
          ) : isLoading ? (
            <Spinner />
          ) : partGroups.length === 0 ? (
            activeLocationFilter ? (
              <Empty icon={<Inbox className="w-6 h-6" />} title="Sin coincidencias" body={`No hay existencias en ubicaciones que coincidan con "${activeLocationFilter}".`} />
            ) : (
            <Empty icon={<Inbox className="w-6 h-6" />} title={q ? "Sin coincidencias" : "Sin existencias"} body={q ? "Ninguna parte coincide con la búsqueda." : "Aún no hay inventario registrado. Se irá poblando con las recepciones y movimientos de almacén."} />
            )
          ) : (
            <div className="space-y-2">
              {partGroups.map((g) => <PartGroupCard key={g.partNumber} g={g} onTrace={goTrace} onCount={countBin} busyCount={busyCount} />)}
            </div>
          )
        )}

        {tab === "shortage" && (
          (ruleForbidden || forbidden) ? (
            <Empty icon={<Lock className="w-6 h-6" />} title="Sin acceso al backend" body="Verifica que el servicio de API esté conectado." />
          ) : (stagingLoading || ruleLoading || isLoading) ? (
            <Spinner />
          ) : shortageRows.length === 0 ? (
            <Empty icon={<Inbox className="w-6 h-6" />} title={q ? "Sin coincidencias" : "Sin escasez"} body={q ? "Ninguna parte coincide con la búsqueda." : "La demanda de las WO activas está cubierta por el almacén y nada está bajo su punto mínimo."} />
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <FlowKpi label="Partes en escasez" value={String(shortageKpis.parts)} icon={<AlertTriangle className="w-3.5 h-3.5" />} color={RED} />
                <FlowKpi label="Faltante total" value={fmtQty(shortageKpis.totalShort)} icon={<ArrowUpRight className="w-3.5 h-3.5" />} color={RED} />
                <FlowKpi label="Bajo mínimo" value={String(shortageKpis.belowMin)} icon={<Repeat className="w-3.5 h-3.5" />} color={AMBER} />
                <FlowKpi label="Confirmadas en línea" value={String(shortageKpis.confirmed)} icon={<PackageSearch className="w-3.5 h-3.5" />} color={RED} />
              </div>
              <p className="text-[11px] text-gray-400 mb-3">
                Demanda = requerido aún sin surtir de las WO activas (líneas de surtido). Disponible = on-hand menos asignado, solo material liberado.
              </p>
              <div className={`${glass} rounded-2xl p-2`}>
                <div className="divide-y divide-gray-100 dark:divide-white/5">
                  {shortageRows.map((r) => (
                    <div key={r.part} className="flex items-center gap-3 px-3 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button onClick={() => goPositions(r.part)} className="font-mono font-semibold text-sm truncate hover:underline" title="Ver existencias de esta parte">{r.part}</button>
                          {r.confirmed && <span className="text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-0.5" style={{ background: `${RED}1f`, color: RED }}><AlertTriangle className="w-3 h-3" /> faltante en línea</span>}
                          {r.belowMin && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${AMBER}1f`, color: AMBER }}>bajo mínimo</span>}
                        </div>
                        <p className="text-[11px] text-gray-400 truncate mt-0.5">
                          demanda {fmtQty(r.demandQty)} · disponible {fmtQty(r.available)}
                          {r.rule ? ` · min ${fmtQty(r.rule.minStock)}/máx ${fmtQty(r.rule.maxStock)}` : ""}
                          {r.rule && Number(r.rule.maxStock ?? 0) - r.available > 0 ? ` · pedir ${fmtQty(Math.max(0, Number(r.rule.maxStock) - r.available))}` : ""}
                          {r.wos.length ? ` · ${r.wos.slice(0, 3).join(", ")}${r.wos.length > 3 ? "…" : ""}` : ""}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-semibold tabular-nums" style={{ color: r.shortage > 0 ? RED : AMBER }}>
                          {r.shortage > 0 ? `−${fmtQty(r.shortage)}` : "OK"}
                        </p>
                        <p className="text-[10px] text-gray-400">{r.shortage > 0 ? "faltante" : "stock bajo"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )
        )}

        {tab === "discrepancies" && (
          (discrepancyForbidden || forbidden) ? (
            <Empty icon={<Lock className="w-6 h-6" />} title="Sin acceso al backend" body="Verifica que el servicio de API este conectado." />
          ) : discrepancyLoading ? (
            <Spinner />
          ) : discrepancyRows.length === 0 ? (
            <Empty
              icon={<ClipboardCheck className="w-6 h-6" />}
              title={q ? "Sin coincidencias" : "Sin discrepancias abiertas"}
              body={q ? "Ninguna discrepancia abierta coincide con la busqueda." : "No hay conteos ya capturados con varianza pendiente de conciliacion o ajuste."}
            />
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <FlowKpi label="Discrepancias" value={String(discrepancySummary.total)} icon={<ClipboardCheck className="w-3.5 h-3.5" />} color={discrepancySummary.total > 0 ? RED : GREEN} />
                <FlowKpi label="Alta severidad" value={String(discrepancySummary.high)} icon={<AlertTriangle className="w-3.5 h-3.5" />} color={discrepancySummary.high > 0 ? RED : GREEN} />
                <FlowKpi label="Faltantes" value={String(discrepancySummary.shortages)} icon={<ArrowUpRight className="w-3.5 h-3.5" />} color={discrepancySummary.shortages > 0 ? RED : GREEN} />
                <FlowKpi label="Varianza neta" value={`${discrepancySummary.netVariance > 0 ? "+" : ""}${fmtQty(discrepancySummary.netVariance)}`} icon={<ArrowLeftRight className="w-3.5 h-3.5" />} color={discrepancySummary.netVariance < 0 ? RED : discrepancySummary.netVariance > 0 ? AMBER : GREEN} />
              </div>
              <div className={`${glass} rounded-2xl p-4 mb-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between`}>
                <p className="text-[12px] text-gray-500 dark:text-gray-400">
                  Fuente: conteos ciclicos en estado COUNTED con varianza distinta de cero. Resolver aqui requiere revisar el bin y cerrar el conteo.
                </p>
                <Link href="/dashboard/cycle-counts" className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-white flex-shrink-0" style={{ background: GREEN }}>
                  Abrir conteos
                </Link>
              </div>
              <div className={`${glass} rounded-2xl p-2`}>
                <div className="divide-y divide-gray-100 dark:divide-white/5">
                  {discrepancyRows.map((item) => {
                    const severity = DISCREPANCY_SEVERITY_META[item.severity];
                    const over = item.direction === "OVERAGE";
                    return (
                      <div key={item.id} className="flex items-start gap-3 px-3 py-3">
                        <span className="text-[10px] font-semibold px-2 py-1 rounded-lg flex-shrink-0" style={{ background: `${severity.color}1f`, color: severity.color }}>
                          {severity.label}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {item.folio && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500">{item.folio}</span>}
                            <button onClick={() => goPositions(item.partNumber)} className="font-mono font-semibold text-sm truncate hover:underline" title="Ver existencias de esta parte">
                              {item.partNumber}
                            </button>
                            {item.location && <span className="text-[11px] text-gray-400">{item.location}</span>}
                            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${over ? AMBER : RED}1f`, color: over ? AMBER : RED }}>
                              {over ? "sobrante" : "faltante"}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-400 truncate mt-0.5">
                            sistema {fmtQty(item.systemQty)} {item.uom} · contado {fmtQty(item.countedQty)} {item.uom}
                            {item.relativeVariancePct !== null ? ` · ${item.relativeVariancePct}%` : ""}
                            {item.countedBy ? ` · ${item.countedBy}` : ""}
                            {item.countedAt ? ` · ${timeAgo(item.countedAt)}` : ""}
                          </p>
                          <p className="text-[11px] mt-1" style={{ color: severity.color }}>
                            {DISCREPANCY_ACTION_LABEL[item.recommendedAction]}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-semibold tabular-nums" style={{ color: over ? AMBER : RED }}>
                            {item.variance > 0 ? "+" : ""}{fmtQty(item.variance)}
                          </p>
                          <p className="text-[10px] text-gray-400">{fmtQty(item.absVariance)} abs</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )
        )}

        {tab === "movements" && (
          movForbidden ? (
            <Empty icon={<Lock className="w-6 h-6" />} title="Sin acceso al backend" body="Verifica que el servicio de API esté conectado." />
          ) : movLoading ? (
            <Spinner />
          ) : movRows.length === 0 ? (
            <Empty icon={<Inbox className="w-6 h-6" />} title={q ? "Sin coincidencias" : "Sin movimientos"} body={q ? "Ningún movimiento coincide con la búsqueda." : "Cada recibo de material, traslado o consumo en la línea aparecerá aquí como un movimiento con su referencia y operador."} />
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 mb-5">
                <FlowKpi label="Recibido" value={fmtQty(flow.received)} icon={<ArrowDownLeft className="w-3.5 h-3.5" />} color={GREEN} />
                <FlowKpi label="Consumido" value={fmtQty(flow.consumed)} icon={<ArrowUpRight className="w-3.5 h-3.5" />} color={RED} />
                <FlowKpi label="Movimientos" value={String(flow.total)} icon={<ArrowLeftRight className="w-3.5 h-3.5" />} color={BLUE} />
              </div>
              <div className={`${glass} rounded-2xl p-2`}>
                <div className="divide-y divide-gray-100 dark:divide-white/5">
                  {movRows.map((m) => {
                    const meta = MOVE_META[m.type] ?? { label: m.type, dir: "neutral" as const, color: "#6b7280" };
                    const sign = meta.dir === "in" ? "+" : meta.dir === "out" ? "−" : "";
                    const where = [m.fromLocation || m.fromWarehouseId, m.toLocation || m.toWarehouseId].filter(Boolean).join(" → ");
                    return (
                      <div key={m.id} className="flex items-center gap-3 px-3 py-3">
                        <span className="text-[10px] font-semibold px-2 py-1 rounded-lg flex-shrink-0" style={{ background: `${meta.color}1f`, color: meta.color }}>
                          {meta.label}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-mono font-semibold text-sm truncate">{m.partNumber}</p>
                          <p className="text-[11px] text-gray-400 truncate">
                            {where || "—"}
                            {m.referenceType ? ` · ${m.referenceType}${m.referenceId ? ` ${m.referenceId}` : ""}` : ""}
                            {m.actorName ? ` · ${m.actorName}` : ""}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-semibold tabular-nums" style={{ color: meta.color }}>{sign}{fmtQty(m.quantity)}</p>
                          <p className="text-[10px] text-gray-400">{timeAgo(m.createdAt)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )
        )}

        {tab === "replenishment" && (
          ruleForbidden ? (
            <Empty icon={<Lock className="w-6 h-6" />} title="Sin acceso al backend" body="Verifica que el servicio de API esté conectado." />
          ) : ruleLoading ? (
            <Spinner />
          ) : ruleRows.length === 0 ? (
            <Empty icon={<Inbox className="w-6 h-6" />} title={q ? "Sin coincidencias" : "Sin reglas de resurtido"} body={q ? "Ninguna regla coincide con la búsqueda." : "Define puntos min-max por parte y almacén para disparar resurtidos. Aún no hay reglas configuradas."} />
          ) : (
            <div className={`${glass} rounded-2xl p-2`}>
              <div className="divide-y divide-gray-100 dark:divide-white/5">
                {ruleRows.map(({ r, available, belowMin, suggested }) => {
                  const active = r.isActive !== false;
                  return (
                    <div key={r.id} className="flex items-center gap-3 px-3 py-3">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: belowMin ? RED : active ? GREEN : "#9ca3af" }} title={active ? "activa" : "inactiva"} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-mono font-semibold text-sm truncate">{r.partNumber}</p>
                          {belowMin && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${RED}1f`, color: RED }}>bajo mínimo</span>}
                          {belowMin && suggested > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${BLUE}1f`, color: BLUE }}>pedir {fmtQty(suggested)}</span>}
                        </div>
                        <p className="text-[11px] text-gray-400 truncate">{r.warehouseId || "—"}{r.priority ? ` · ${r.priority}` : ""} · on-hand {fmtQty(available)}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold tabular-nums">{fmtQty(r.minStock)} → {fmtQty(r.maxStock)}</p>
                        <p className="text-[10px] text-gray-400">min → max{r.safetyStock ? ` · ss ${fmtQty(r.safetyStock)}` : ""}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        )}

        {tab === "traceability" && <TraceabilityPanel key={tracePart} initialPart={tracePart} />}
      </main>
    </div>
  );
}

// ── Existencias: tarjeta por parte con detalle por ubicación (rack/bin) ────────
function PartGroupCard({ g, onTrace, onCount, busyCount }: {
  g: { partNumber: string; description: string; uom: string; onHand: number; allocated: number; available: number; rows: Position[] };
  onTrace: (part: string) => void;
  onCount: (p: Position, uom: string) => void;
  busyCount: string | number | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`${glass} rounded-2xl`}>
      <div className="flex items-center">
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-3 px-4 py-3 text-left flex-1 min-w-0">
          <ChevronRight className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
          <div className="min-w-0 flex-1">
            <p className="font-mono font-semibold text-sm truncate">{g.partNumber}</p>
            <p className="text-[11px] text-gray-400 truncate">
              {g.description || "—"} · {g.rows.length} ubicación{g.rows.length === 1 ? "" : "es"}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="font-semibold tabular-nums">{fmtQty(g.available)}<span className="text-[11px] text-gray-400 ml-1">{g.uom}</span></p>
            <p className="text-[10px] text-gray-400">disponible{g.allocated > 0 ? ` · ${fmtQty(g.allocated)} asignado` : ""}</p>
          </div>
        </button>
        <button onClick={() => onTrace(g.partNumber)} title="Trazabilidad (where-used)" className="px-3.5 py-3 text-gray-400 hover:text-[#16a394] flex-shrink-0">
          <GitBranch className="w-4 h-4" />
        </button>
      </div>
      {open && (
        <div className="px-4 pb-3 pt-1 border-t border-gray-100 dark:border-white/5">
          <div className="space-y-1.5 mt-2">
            {g.rows.map((p) => {
              const hold = HOLD_META[p.holdStatus ?? "available"] ?? { label: p.holdStatus ?? "—", color: "#6b7280" };
              const avail = Number(p.onHand ?? 0) - Number(p.allocated ?? 0);
              return (
                <div key={p.id} className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-white/5">
                  <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{p.location || "BULK"}</span>
                    {p.warehouse?.name && <span className="text-[11px] text-gray-400 ml-1.5">{p.warehouse.name}</span>}
                    {(p.lotNumber || p.serialNumber) && (
                      <span className="text-[11px] text-gray-400 ml-1.5">
                        {p.lotNumber ? `lote ${p.lotNumber}` : ""}{p.lotNumber && p.serialNumber ? " · " : ""}{p.serialNumber ? `s/n ${p.serialNumber}` : ""}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: `${hold.color}1f`, color: hold.color }}>{hold.label}</span>
                  <span className="tabular-nums text-xs flex-shrink-0 w-20 text-right">
                    <span className="font-semibold">{fmtQty(avail)}</span>
                    {Number(p.allocated ?? 0) > 0 && <span className="text-gray-400"> / {fmtQty(p.onHand)}</span>}
                  </span>
                  <button
                    onClick={() => onCount(p, g.uom)}
                    disabled={busyCount === p.id}
                    title="Crear conteo cíclico de este bin"
                    className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-[#16a394] hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50"
                  >
                    {busyCount === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardCheck className="w-3.5 h-3.5" />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Trazabilidad: where-used (contención) por parte (+serial opcional) ─────────
function TraceabilityPanel({ initialPart = "" }: { initialPart?: string }) {
  const [partInput, setPartInput] = useState(initialPart);
  const [serialInput, setSerialInput] = useState("");
  const [query, setQuery] = useState<{ part: string; serial: string } | null>(
    initialPart ? { part: initialPart, serial: "" } : null,
  );

  const key = query
    ? `/floor-quality/where-used?part=${encodeURIComponent(query.part)}${query.serial ? `&serial=${encodeURIComponent(query.serial)}` : ""}`
    : null;
  const { data, isLoading, forbidden } = useApi<ConsumptionEvent[]>(key);
  const events = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  function run() {
    const part = partInput.trim();
    if (!part) return;
    setQuery({ part, serial: serialInput.trim() });
  }

  return (
    <div>
      <div className={`${glass} rounded-2xl p-4 mb-4`}>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <label className="block flex-1">
            <span className="block text-[12px] font-medium text-gray-500 mb-1">N° de parte (componente)</span>
            <input value={partInput} onChange={(e) => setPartInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") run(); }} placeholder="CAP-0402-100NF" className="inv-input font-mono" />
          </label>
          <label className="block flex-1">
            <span className="block text-[12px] font-medium text-gray-500 mb-1">Serial de unidad (opcional)</span>
            <input value={serialInput} onChange={(e) => setSerialInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") run(); }} placeholder="SN-000123" className="inv-input font-mono" />
          </label>
          <button onClick={run} disabled={!partInput.trim()} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50" style={{ background: GREEN }}>
            <Search className="w-4 h-4" /> Rastrear
          </button>
        </div>
        <p className="text-[11px] text-gray-400 mt-2">
          Where-used (contención): dado un componente, muestra en qué unidades/WO se consumió (genealogía del ledger de consumo). Para la vista inversa (unidad → componentes as-built), abre{" "}
          <Link
            href={serialInput.trim() ? `/dashboard/genealogy?serial=${encodeURIComponent(serialInput.trim())}` : "/dashboard/genealogy"}
            className="underline underline-offset-2 hover:text-gray-600 dark:hover:text-gray-300"
          >
            Genealogía
          </Link>
          .
        </p>
      </div>

      {forbidden ? (
        <Empty icon={<Lock className="w-6 h-6" />} title="Sin acceso" body="La trazabilidad lee el ledger de calidad; requiere permiso de Calidad (quality:read)." />
      ) : !query ? (
        <Empty icon={<GitBranch className="w-6 h-6" />} title="Rastrea un componente" body="Escribe un número de parte (y opcionalmente un serial) para ver dónde se consumió." />
      ) : isLoading ? (
        <Spinner />
      ) : events.length === 0 ? (
        <Empty icon={<Inbox className="w-6 h-6" />} title="Sin consumo registrado" body={`No hay eventos de consumo para ${query.part}${query.serial ? ` · serial ${query.serial}` : ""}. Aparecerán cuando el operador confirme producción con genealogía.`} />
      ) : (
        <>
          <p className="text-[11px] text-gray-400 mb-2">{events.length} evento{events.length === 1 ? "" : "s"} de consumo de <span className="font-mono">{query.part}</span>{query.serial ? <> · serial <span className="font-mono">{query.serial}</span></> : null}</p>
          <div className={`${glass} rounded-2xl p-2`}>
            <div className="divide-y divide-gray-100 dark:divide-white/5">
              {events.map((e) => (
                <div key={e.id} className="flex items-center gap-3 px-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-semibold text-sm">{e.woFolio || e.woId}</span>
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500">{e.station}</span>
                      {e.unitSerial && <span className="text-[11px] text-gray-400">s/n {e.unitSerial}</span>}
                    </div>
                    <p className="text-[11px] text-gray-400 truncate mt-0.5">
                      {e.model}{e.operatorEmail ? ` · ${e.operatorEmail}` : ""}{e.createdAt ? ` · ${timeAgo(e.createdAt)}` : ""}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold tabular-nums">{fmtQty(e.backflushQty)}</p>
                    <p className="text-[10px] text-gray-400">{fmtQty(e.units)} u</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <style jsx global>{`
        .inv-input {
          border-radius: 0.75rem;
          padding: 0.55rem 0.75rem;
          background: rgba(0, 0, 0, 0.03);
          border: 1px solid rgba(0, 0, 0, 0.08);
          outline: none;
          font-size: 0.875rem;
          width: 100%;
        }
        .inv-input:focus { border-color: ${GREEN}; }
        :global(.dark) .inv-input {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </div>
  );
}

function TabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-sm font-medium transition-colors ${
        active ? "bg-white text-black shadow-sm dark:bg-white/15 dark:text-white" : "text-gray-500 hover:text-foreground"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function FlowKpi({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div className={`${glass} rounded-2xl p-3`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-gray-400">
        <span style={{ color }}>{icon}</span> {label}
      </div>
      <div className="text-xl font-semibold mt-1 tabular-nums" style={{ color }}>{value}</div>
    </div>
  );
}

function Spinner() {
  return <div className="flex justify-center py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>;
}

function Empty({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center text-center py-16 px-6">
      <div className="p-4 rounded-2xl bg-gray-100 dark:bg-white/5 text-gray-400 mb-4">{icon}</div>
      <h3 className="font-bold text-lg mb-1">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">{body}</p>
    </div>
  );
}
