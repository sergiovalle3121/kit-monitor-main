"use client";

import React, { useMemo, useState } from "react";
import { Loader2, Lock, Inbox, Search, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, SlidersHorizontal } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { glass } from "@/lib/glass";
import { useApi } from "@/hooks/useApi";

interface Position {
  id: number | string; partNumber: string; location?: string;
  warehouse?: { name?: string; code?: string } | null;
  quantityOnHand?: number; quantityAvailable?: number; quantityAllocated?: number;
  onHand?: number; available?: number; allocated?: number;
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

function fmtQty(n: number | undefined): string {
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

export default function InventoryPage() {
  const [tab, setTab] = useState<"positions" | "movements">("positions");
  const { data, isLoading, forbidden } = useApi<Position[]>("/inventory/positions");
  // El ledger de movimientos solo se pide cuando la pestaña está activa.
  const { data: movData, isLoading: movLoading, forbidden: movForbidden } =
    useApi<Movement[]>(tab === "movements" ? "/inventory/movements" : null);
  const [q, setQ] = useState("");

  const positions = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const movements = useMemo(() => (Array.isArray(movData) ? movData : []), [movData]);

  const posRows = q
    ? positions.filter((p) => `${p.partNumber} ${p.location ?? ""}`.toLowerCase().includes(q.toLowerCase()))
    : positions;
  const movRows = q
    ? movements.filter((m) => `${m.partNumber} ${m.referenceId ?? ""} ${m.actorName ?? ""}`.toLowerCase().includes(q.toLowerCase()))
    : movements;

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

  const showSearch = tab === "positions" ? positions.length > 0 : movements.length > 0;

  return (
    <div className="min-h-screen text-black dark:text-white font-sans pb-32">
      <main className="max-w-4xl mx-auto px-6 pt-10">
        <PageHeader domain="inventory" title="Inventario" subtitle="Existencias y movimientos por ubicación" />

        {/* Pestañas */}
        <div className={`${glass} inline-flex items-center gap-1 p-1 rounded-2xl mb-5`}>
          <TabBtn active={tab === "positions"} onClick={() => setTab("positions")} icon={<SlidersHorizontal className="w-4 h-4" />}>Existencias</TabBtn>
          <TabBtn active={tab === "movements"} onClick={() => setTab("movements")} icon={<ArrowLeftRight className="w-4 h-4" />}>Movimientos</TabBtn>
        </div>

        {showSearch && (
          <div className={`${glass} flex items-center gap-2 px-4 py-2.5 rounded-2xl mb-5`}>
            <Search className="w-4 h-4 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={tab === "positions" ? "Buscar número de parte o ubicación…" : "Buscar parte, referencia u operador…"}
              className="bg-transparent outline-none text-sm w-full"
            />
          </div>
        )}

        {tab === "positions" ? (
          forbidden ? (
            <Empty icon={<Lock className="w-6 h-6" />} title="Sin acceso al backend" body="Verifica que el servicio de API esté conectado." />
          ) : isLoading ? (
            <Spinner />
          ) : posRows.length === 0 ? (
            <Empty icon={<Inbox className="w-6 h-6" />} title="Sin existencias" body="Aún no hay inventario registrado. Se irá poblando con las recepciones y movimientos de almacén." />
          ) : (
            <div className={`${glass} rounded-2xl p-2`}>
              <div className="divide-y divide-gray-100 dark:divide-white/5">
                {posRows.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-3 py-3">
                    <div className="min-w-0">
                      <p className="font-mono font-semibold text-sm truncate">{p.partNumber}</p>
                      <p className="text-[11px] text-gray-400">{p.location ?? "—"}{p.warehouse?.name ? ` · ${p.warehouse.name}` : ""}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-semibold tabular-nums">{fmtQty(p.quantityAvailable ?? p.available ?? p.quantityOnHand ?? p.onHand)}</p>
                      <p className="text-[10px] text-gray-400">disponible</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        ) : movForbidden ? (
          <Empty icon={<Lock className="w-6 h-6" />} title="Sin acceso al backend" body="Verifica que el servicio de API esté conectado." />
        ) : movLoading ? (
          <Spinner />
        ) : movements.length === 0 ? (
          <Empty icon={<Inbox className="w-6 h-6" />} title="Sin movimientos" body="Cada recibo de material, traslado o consumo en la línea aparecerá aquí como un movimiento con su referencia y operador." />
        ) : (
          <>
            {/* Resumen del flujo recibo → consumo (en vivo, derivado del ledger) */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <FlowKpi label="Recibido" value={fmtQty(flow.received)} icon={<ArrowDownLeft className="w-3.5 h-3.5" />} color="#16a394" />
              <FlowKpi label="Consumido" value={fmtQty(flow.consumed)} icon={<ArrowUpRight className="w-3.5 h-3.5" />} color="#ef4444" />
              <FlowKpi label="Movimientos" value={String(flow.total)} icon={<ArrowLeftRight className="w-3.5 h-3.5" />} color="#0a84ff" />
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
        )}
      </main>
    </div>
  );
}

function TabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-sm font-medium transition-colors ${
        active ? "bg-white text-black shadow-sm dark:bg-white/15 dark:text-white" : "text-gray-500 hover:text-black dark:hover:text-white"
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
