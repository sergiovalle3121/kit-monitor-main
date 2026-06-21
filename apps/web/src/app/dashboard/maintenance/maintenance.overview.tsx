"use client";

// Overview / KPI board: the morning glance for the maintenance lead. Everything
// here is real — server KPIs (GET /maintenance/kpis) plus a couple of figures
// derived live from the order list (backlog, open orders per asset). MTBF is
// honestly flagged as missing because the backend does not expose it yet.
import React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CalendarClock,
  Gauge,
  Siren,
  Timer,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { glass } from "@/lib/glass";
import { Kpi, MiniBar, Pill } from "./maintenance.ui";
import { AssetStatusSelect, NewOrderButton } from "./maintenance.actions";
import {
  COLORS,
  CRITICALITY_META,
  TYPE_META,
  TYPE_ORDER,
  fmtMinutes,
  openOrdersByAsset,
  typeMix,
} from "./maintenance.utils";
import type {
  Asset,
  CreateOrderInput,
  MaintenanceKpis,
  MaintenanceOrder,
} from "./maintenance.types";

export function OverviewTab({
  kpis,
  orders,
  assets,
  onNewOrder,
  onGoOrders,
  refreshAssets,
}: {
  kpis?: MaintenanceKpis;
  orders: MaintenanceOrder[];
  assets: Asset[];
  onNewOrder: (prefill?: Partial<CreateOrderInput>) => void;
  onGoOrders: () => void;
  refreshAssets: () => void;
}) {
  const backlog = (kpis?.ordersOpen ?? 0) + (kpis?.ordersInProgress ?? 0);
  const overdue = kpis?.ordersOverdue ?? 0;
  const assetsDown = kpis?.assetsDown ?? assets.filter((a) => a.status === "DOWN").length;
  const downAssets = assets.filter((a) => a.status === "DOWN");
  const load = openOrdersByAsset(orders, assets);
  const maxLoad = load.reduce((m, r) => Math.max(m, r.total), 0);
  const mix = typeMix(orders);
  const totalMix = mix.PREVENTIVE + mix.CORRECTIVE + mix.PREDICTIVE;

  return (
    <div className="space-y-6">
      {/* B1 — Gancho con downtime / andon del piso: activos en avería resaltados. */}
      {downAssets.length > 0 && (
        <section
          className="rounded-2xl p-4 border"
          style={{ background: `${COLORS.red}10`, borderColor: `${COLORS.red}40` }}
        >
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 rounded-xl grid place-items-center flex-shrink-0" style={{ background: `${COLORS.red}1f` }}>
              <Siren className="w-5 h-5" style={{ color: COLORS.red }} />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold" style={{ color: COLORS.red }}>
                {downAssets.length} {downAssets.length === 1 ? "activo en avería" : "activos en avería"}
              </h3>
              <p className="text-[12px] text-gray-500 dark:text-gray-400">
                En el piso, una máquina caída dispara un andon de Mantto (ANDON_MACHINE).{" "}
                <Link href="/dashboard/operador" className="underline underline-offset-2 hover:opacity-80">
                  Ver terminal de piso
                </Link>
                . Levanta una orden correctiva y, al resolver, marca el activo operativo.
              </p>
              <div className="mt-3 space-y-2">
                {downAssets.map((a) => (
                  <div key={a.id} className={`${glass} rounded-xl p-3 flex flex-wrap items-center gap-3`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{a.name}</span>
                        <Pill label={CRITICALITY_META[a.criticality].label} color={CRITICALITY_META[a.criticality].color} />
                      </div>
                      {(a.code || a.location) && (
                        <div className="text-[12px] text-gray-400 truncate">
                          {[a.code, a.location].filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() =>
                        onNewOrder({
                          type: "CORRECTIVE",
                          priority: "HIGH",
                          assetId: a.id,
                          title: `Avería: ${a.name}`,
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-white"
                      style={{ background: COLORS.red }}
                    >
                      <Wrench className="w-3.5 h-3.5" /> Orden correctiva
                    </button>
                    <AssetStatusSelect asset={a} onChanged={refreshAssets} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi
          label="Backlog"
          value={backlog}
          sub={`${kpis?.ordersOpen ?? 0} abiertas · ${kpis?.ordersInProgress ?? 0} en progreso`}
          color={backlog > 0 ? COLORS.amber : COLORS.green}
        />
        <Kpi
          label="Vencidas"
          value={overdue}
          sub={overdue > 0 ? "requieren atención" : "al día"}
          color={overdue > 0 ? COLORS.red : COLORS.green}
        />
        <Kpi
          label="MTTR"
          value={kpis?.mttrHours == null ? "—" : `${kpis.mttrHours} h`}
          sub={`${fmtMinutes(kpis?.totalDowntimeMinutes)} de paro`}
          color={COLORS.violet}
        />
        <Kpi
          label="MTBF"
          value="—"
          color={COLORS.gray}
          hint="Requiere backend"
        />
        <Kpi
          label="% PM cumplido"
          value={kpis?.pmCompliance == null ? "—" : `${kpis.pmCompliance}%`}
          sub={`${mix.PREVENTIVE} preventivas`}
          color={COLORS.blue}
        />
        <Kpi
          label="Activos parados"
          value={`${assetsDown}/${kpis?.assetsTotal ?? assets.length}`}
          sub={assetsDown > 0 ? "en avería" : "todo operando"}
          color={assetsDown > 0 ? COLORS.red : COLORS.green}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Órdenes abiertas por activo (derivado del listado en vivo) */}
        <section className={`${glass} rounded-2xl p-5 lg:col-span-2`}>
          <div className="flex items-center gap-2 mb-4">
            <Boxes className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-semibold">Órdenes abiertas por activo</h3>
            <button onClick={onGoOrders} className="ml-auto text-[12px] text-gray-400 hover:text-black dark:hover:text-white inline-flex items-center gap-1">
              Ver órdenes <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {load.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">Sin trabajo abierto. Buen momento para programar preventivos.</p>
          ) : (
            <div className="space-y-3">
              {load.slice(0, 8).map((row) => (
                <div key={row.key} className="flex items-center gap-3">
                  <div className="w-40 md:w-52 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {row.down && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORS.red }} title="En avería" />}
                      <span className="text-sm truncate">{row.assetName}</span>
                    </div>
                    <div className="text-[11px] text-gray-400">
                      {row.open} abiertas{row.inProgress > 0 ? ` · ${row.inProgress} en progreso` : ""}
                    </div>
                  </div>
                  <div className="flex-1">
                    <MiniBar value={row.total} max={maxLoad} color={row.down ? COLORS.red : COLORS.violet} />
                  </div>
                  <span className="text-sm font-semibold w-6 text-right tabular-nums">{row.total}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Mezcla por tipo + nota MTBF */}
        <section className={`${glass} rounded-2xl p-5`}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-semibold">Carga por tipo</h3>
          </div>
          {totalMix === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">Aún no hay órdenes.</p>
          ) : (
            <div className="space-y-3">
              {TYPE_ORDER.map((t) => (
                <div key={t}>
                  <div className="flex items-center justify-between text-[12px] mb-1">
                    <span style={{ color: TYPE_META[t].color }}>{TYPE_META[t].label}</span>
                    <span className="text-gray-400 tabular-nums">{mix[t]}</span>
                  </div>
                  <MiniBar value={mix[t]} max={totalMix} color={TYPE_META[t].color} />
                </div>
              ))}
            </div>
          )}
          <div className="mt-5 pt-4 border-t border-black/5 dark:border-white/10 space-y-2">
            <NewOrderButton onClick={() => onNewOrder()} className="w-full justify-center" />
            <div className="flex items-start gap-2 text-[11px] text-gray-400">
              <Gauge className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>
                MTTR sale de los paros registrados al cerrar órdenes. MTBF aún{" "}
                <span className="font-medium">requiere backend</span> (no expone fallas por equipo).
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* Pie con accesos rápidos a la salud del lane */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[12px]">
        <QuickStat icon={<Timer className="w-4 h-4" />} label="Completadas" value={kpis?.ordersCompleted ?? 0} />
        <QuickStat icon={<AlertTriangle className="w-4 h-4" />} label="Vencidas" value={overdue} color={overdue > 0 ? COLORS.red : undefined} />
        <QuickStat icon={<CalendarClock className="w-4 h-4" />} label="Preventivas" value={mix.PREVENTIVE} />
        <QuickStat icon={<Boxes className="w-4 h-4" />} label="Activos" value={kpis?.assetsTotal ?? assets.length} />
      </div>
    </div>
  );
}

function QuickStat({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color?: string;
}) {
  return (
    <div className={`${glass} rounded-xl px-4 py-3 flex items-center gap-3`}>
      <span className="text-gray-400">{icon}</span>
      <div className="min-w-0">
        <div className="text-lg font-semibold leading-none" style={color ? { color } : undefined}>{value}</div>
        <div className="text-[11px] text-gray-400 mt-0.5 truncate">{label}</div>
      </div>
    </div>
  );
}
