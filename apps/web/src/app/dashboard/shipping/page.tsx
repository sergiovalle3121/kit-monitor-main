"use client";

// Shipping (Embarques) — operating screen over the real `shipping` module
// (9 endpoints). One screen: a filterable list with live status chips + derived
// KPIs, a create dialog, a per-row primary state-machine action, and a detail
// drawer (items, packing lists, manifest, transitions, discrepancy, labels/ASN).
// Data: GET /shipping for the list; the drawer pulls GET /shipping/:id for the
// full entity. No /kpis endpoint exists → KPIs are derived client-side.
import React, { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Inbox, Loader2, Lock, Plus, Search, Truck } from "lucide-react";
import { glass } from "@/lib/glass";
import { useApi } from "@/hooks/useApi";
import { Empty, Kpi, ShpInputStyle, StatusChip, StatusPill } from "./shipping.ui";
import { CreateShipmentModal, RowActions } from "./shipping.actions";
import { ShipmentDrawer } from "./shipping.detail";
import {
  ACCENT,
  COLORS,
  STATUS_META,
  STATUS_ORDER,
  compareShipments,
  deriveKpis,
  isLate,
  scheduledLabel,
} from "./shipping.utils";
import type { Shipment, ShipmentStatus } from "./shipping.types";

export default function ShippingPage() {
  const { data, isLoading, forbidden, mutate } = useApi<Shipment[]>("/shipping");
  const list = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<ShipmentStatus | "">("");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const kpis = useMemo(() => deriveKpis(list), [list]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { "": list.length };
    for (const s of STATUS_ORDER) c[s] = 0;
    for (const s of list) c[s.status] = (c[s.status] ?? 0) + 1;
    return c;
  }, [list]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return list
      .filter((s) => {
        if (status && s.status !== status) return false;
        if (needle) {
          const hay = `${s.shipmentNumber} ${s.customer} ${s.carrier ?? ""} ${s.route ?? ""} ${s.truckPlate ?? ""} ${s.driverName ?? ""} ${s.trackingNumber ?? ""} ${s.dockNumber ?? ""}`.toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        return true;
      })
      .sort(compareShipments);
  }, [list, q, status]);

  const anyFilter = !!(q || status);

  if (forbidden) {
    return (
      <div className="min-h-screen grid place-items-center text-foreground">
        <div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}>
          <Lock className="w-8 h-8 mx-auto mb-3 text-gray-400" />
          <h2 className="text-lg font-semibold">Sin acceso</h2>
          <p className="text-sm text-gray-400 mt-1">Inicia sesión para ver embarques.</p>
        </div>
      </div>
    );
  }

  const firstLoad = isLoading && data === undefined;

  return (
    <div className="min-h-screen text-foreground">
      {/* Header (sticky) */}
      <div className={`${glass} sticky top-0 z-40 px-6 py-4`}>
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Link href="/dashboard" aria-label="Volver al inicio" className="p-2 -ml-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <span className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: `${ACCENT}1f` }}>
            <Truck className="w-5 h-5" style={{ color: ACCENT }} />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold leading-tight">Logística · Embarques</h1>
            <p className="text-[12px] text-gray-400 leading-tight">Surtido, manifiesto, despacho y cierre</p>
          </div>
          <button onClick={() => setShowCreate(true)} aria-label="Nuevo embarque" className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white" style={{ background: ACCENT }}>
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Nuevo embarque</span>
          </button>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 pt-8 pb-28">
        {/* KPIs (derivados de la lista) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Kpi label="En operación" value={kpis.open} color={ACCENT} sub={`${kpis.total} en total`} />
          <Kpi label="Surtidos" value={kpis.staged} color={COLORS.amber} sub="esperando carga" />
          <Kpi label="En tránsito" value={kpis.inTransit} color={COLORS.indigo} sub="despachados" />
          <Kpi label="Con cita vencida" value={kpis.late} color={kpis.late > 0 ? COLORS.red : COLORS.green} sub="aún sin salir" />
        </div>

        {/* Buscador + alta */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar folio, cliente, transportista, guía…" className="shp-input pl-9" />
          </div>
          <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white" style={{ background: ACCENT }}>
            <Plus className="w-4 h-4" /> Nuevo embarque
          </button>
        </div>

        {/* Filtro de estado segmentado, con conteos */}
        <div className="flex items-center gap-1.5 flex-wrap mb-5">
          <StatusChip label="Todos" count={counts[""]} active={status === ""} color={COLORS.gray} onClick={() => setStatus("")} />
          {STATUS_ORDER.map((s) => (
            <StatusChip
              key={s}
              label={STATUS_META[s].label}
              count={counts[s] ?? 0}
              active={status === s}
              color={STATUS_META[s].color}
              onClick={() => setStatus(status === s ? "" : s)}
            />
          ))}
        </div>

        {/* Lista */}
        {firstLoad ? (
          <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : list.length === 0 ? (
          <div className={`${glass} rounded-2xl`}>
            <Empty
              icon={<Truck className="w-7 h-7" />}
              title="Sin embarques"
              body="Crea el primer embarque para surtir material, abrir el manifiesto y despachar — con traza de inventario en cada paso."
              cta={
                <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: ACCENT }}>
                  <Plus className="w-4 h-4" /> Nuevo embarque
                </button>
              }
            />
          </div>
        ) : rows.length === 0 ? (
          <div className={`${glass} rounded-2xl p-10 text-center`}>
            <Inbox className="w-7 h-7 mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-gray-400">Ningún embarque coincide con el filtro.</p>
            {anyFilter && (
              <button onClick={() => { setQ(""); setStatus(""); }} className="mt-3 text-[13px] underline underline-offset-2 text-gray-500">
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {rows.map((s) => (
              <ShipmentRow key={s.id} shipment={s} onOpen={() => setSelectedId(s.id)} onChanged={mutate} />
            ))}
          </div>
        )}
      </main>

      {showCreate && (
        <CreateShipmentModal
          onClose={() => setShowCreate(false)}
          onCreated={(created) => {
            mutate();
            if (created?.id) setSelectedId(created.id);
          }}
        />
      )}

      {selectedId !== null && (
        <ShipmentDrawer shipmentId={selectedId} onClose={() => setSelectedId(null)} onListChanged={mutate} />
      )}

      {/* Estilos de inputs glass (para el buscador y filtros fuera de modales). */}
      <ShpInputStyle />
    </div>
  );
}

// ── Fila de embarque ─────────────────────────────────────────────────────────
function ShipmentRow({
  shipment,
  onOpen,
  onChanged,
}: {
  shipment: Shipment;
  onOpen: () => void;
  onChanged: () => void;
}) {
  const late = isLate(shipment);
  const meta = [shipment.carrier, shipment.route, shipment.dockNumber && `Andén ${shipment.dockNumber}`, shipment.trackingNumber]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className={`${glass} rounded-2xl p-4`}>
      <div className="flex items-start gap-3">
        <button onClick={onOpen} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500">{shipment.shipmentNumber}</span>
            <span className="font-semibold truncate">{shipment.customer}</span>
            <StatusPill status={shipment.status} />
            {late && (
              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${COLORS.red}1f`, color: COLORS.red }}>cita vencida</span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2 text-[12px] text-gray-400 flex-wrap">
            {meta ? <span className="truncate">{meta}</span> : <span className="italic">Sin manifiesto</span>}
            {shipment.scheduledAt && (
              <>
                <span>•</span>
                <span style={late ? { color: COLORS.red } : undefined}>cita {scheduledLabel(shipment.scheduledAt)}</span>
              </>
            )}
          </div>
        </button>
        <div className="flex-shrink-0">
          <RowActions shipment={shipment} onChanged={onChanged} />
        </div>
      </div>
    </div>
  );
}
