"use client";

// Preventive maintenance. The backend has NO scheduler/calendar/recurrence yet
// (apps/api/.../maintenance exposes assets + orders + kpis only), so we are
// honest about that — a "requiere backend" panel lists what a real PM program
// needs — while still giving a usable agenda built from the real due dates of
// existing PREVENTIVE orders.
import React, { useMemo } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Plus,
  ServerCog,
  Wrench,
} from "lucide-react";
import { glass } from "@/lib/glass";
import { Empty, Kpi, StatusPill } from "./maintenance.ui";
import { TransitionControls } from "./maintenance.actions";
import {
  COLORS,
  DUE_BUCKET_META,
  DUE_BUCKET_ORDER,
  bucketByDue,
  dueLabel,
  isOverdue,
} from "./maintenance.utils";
import type {
  CreateOrderInput,
  MaintenanceKpis,
  MaintenanceOrder,
} from "./maintenance.types";

export function PreventiveTab({
  orders,
  kpis,
  onNewOrder,
  refresh,
}: {
  orders: MaintenanceOrder[];
  kpis?: MaintenanceKpis;
  onNewOrder: (prefill?: Partial<CreateOrderInput>) => void;
  refresh: () => void;
}) {
  const preventive = useMemo(() => orders.filter((o) => o.type === "PREVENTIVE"), [orders]);
  const buckets = useMemo(() => bucketByDue(preventive), [preventive]);
  const overdueCount = buckets.overdue.length;
  const completed = buckets.done.length;
  const planned = preventive.length - completed;

  const newPm = () => onNewOrder({ type: "PREVENTIVE", priority: "MEDIUM" });

  return (
    <div className="space-y-6">
      {/* Estado honesto: el backend aún no programa PMs */}
      <section
        className="rounded-2xl p-4 border"
        style={{ background: `${COLORS.amber}10`, borderColor: `${COLORS.amber}40` }}
      >
        <div className="flex items-start gap-3">
          <span className="w-9 h-9 rounded-xl grid place-items-center flex-shrink-0" style={{ background: `${COLORS.amber}1f` }}>
            <ServerCog className="w-5 h-5" style={{ color: COLORS.amber }} />
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold flex items-center gap-2">
              Programación automática
              <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: `${COLORS.amber}26`, color: COLORS.amber }}>
                Requiere backend
              </span>
            </h3>
            <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-1">
              El API de mantenimiento expone activos, órdenes y KPIs, pero todavía no hay
              calendario ni recurrencia de PM. Por ahora la agenda de abajo se arma con la
              <span className="font-medium"> fecha de vencimiento</span> de las órdenes preventivas que captures a mano.
            </p>
            <ul className="mt-2 text-[12px] text-gray-500 dark:text-gray-400 grid sm:grid-cols-2 gap-x-6 gap-y-1 list-disc pl-4">
              <li>Plantillas de PM por activo (tareas + frecuencia)</li>
              <li>Recurrencia (cada N días / horas-máquina / ciclos)</li>
              <li>Auto-generación de la próxima orden al cerrar</li>
              <li>Disparo por medidor / condición (predictivo)</li>
            </ul>
          </div>
        </div>
      </section>

      {/* KPIs preventivos reales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi
          label="% PM cumplido"
          value={kpis?.pmCompliance == null ? "—" : `${kpis.pmCompliance}%`}
          sub="preventivas completadas"
          color={COLORS.blue}
        />
        <Kpi label="PM planeadas" value={planned} sub="abiertas / en progreso" color={planned > 0 ? COLORS.violet : COLORS.green} />
        <Kpi label="PM vencidas" value={overdueCount} sub={overdueCount > 0 ? "requieren atención" : "al día"} color={overdueCount > 0 ? COLORS.red : COLORS.green} />
        <Kpi label="PM completadas" value={completed} color={COLORS.green} />
      </div>

      {/* Agenda por vencimiento */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-gray-400" /> Agenda preventiva
        </h3>
        <button
          onClick={newPm}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white"
          style={{ background: COLORS.blue }}
        >
          <Plus className="w-4 h-4" /> Nueva preventiva
        </button>
      </div>

      {preventive.length === 0 ? (
        <div className={`${glass} rounded-2xl`}>
          <Empty
            icon={<CalendarClock className="w-7 h-7" />}
            title="Sin mantenimiento preventivo"
            body="Crea órdenes de tipo preventivo con su fecha de vencimiento y aparecerán aquí como agenda. El % PM cumplido empieza a medir en cuanto las cierres."
            cta={
              <button onClick={newPm} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: COLORS.blue }}>
                <Plus className="w-4 h-4" /> Nueva preventiva
              </button>
            }
          />
        </div>
      ) : (
        <div className="space-y-6">
          {DUE_BUCKET_ORDER.map((key) => {
            const items = buckets[key];
            if (items.length === 0) return null;
            const meta = DUE_BUCKET_META[key];
            return (
              <section key={key}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: meta.color }} />
                  <h4 className="text-sm font-semibold">{meta.label}</h4>
                  <span className="text-[11px] text-gray-400">({items.length})</span>
                </div>
                <div className="space-y-2.5">
                  {items.map((o) => (
                    <PreventiveRow key={o.id} order={o} onChanged={refresh} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PreventiveRow({
  order,
  onChanged,
}: {
  order: MaintenanceOrder;
  onChanged: () => void;
}) {
  const overdue = isOverdue(order);
  const done = order.status === "COMPLETED";
  return (
    <div className={`${glass} rounded-2xl p-4 flex items-start gap-3`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          {order.folio && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500">{order.folio}</span>}
          <span className="font-semibold truncate">{order.title}</span>
          <StatusPill status={order.status} />
        </div>
        <div className="mt-1.5 flex items-center gap-2 text-[12px] text-gray-400 flex-wrap">
          {order.assetName && <span className="inline-flex items-center gap-1"><Wrench className="w-3 h-3" />{order.assetName}</span>}
          <span className="inline-flex items-center gap-1" style={overdue ? { color: COLORS.red } : done ? { color: COLORS.green } : undefined}>
            {done ? <CheckCircle2 className="w-3 h-3" /> : <CalendarClock className="w-3 h-3" />}
            {done ? "Completada" : dueLabel(order.dueDate)}
          </span>
        </div>
      </div>
      <TransitionControls order={order} onDone={onChanged} />
    </div>
  );
}
