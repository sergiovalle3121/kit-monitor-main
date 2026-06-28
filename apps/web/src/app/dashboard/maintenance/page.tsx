"use client";

// Maintenance / TPM cockpit (CMMS). A single tabbed shell over the real backend
// (apps/api/.../maintenance): overview KPIs, the asset registry, the work-order
// workbench with its state machine, and a preventive agenda. Data fetching and
// the shared "new order" dialog live here; each tab is a co-located component.
import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  ChevronLeft,
  ClipboardList,
  Gauge,
  HardDrive,
  Loader2,
  Lock,
  Plus,
  Wrench,
} from "lucide-react";
import { glass } from "@/lib/glass";
import { useApi } from "@/hooks/useApi";
import { MInputStyle, TabBtn } from "./maintenance.ui";
import { OrderFormModal } from "./maintenance.actions";
import { OverviewTab } from "./maintenance.overview";
import { AssetsTab } from "./maintenance.assets";
import { OrdersTab } from "./maintenance.orders";
import { PreventiveTab } from "./maintenance.preventive";
import { COLORS, backlogCount } from "./maintenance.utils";
import type {
  Asset,
  CreateOrderInput,
  MaintenanceKpis,
  MaintenanceOrder,
  PmPlan,
} from "./maintenance.types";

type Tab = "overview" | "assets" | "orders" | "preventive";

export default function MaintenancePage() {
  const { data: orders, isLoading, forbidden, mutate: mutateOrders } = useApi<MaintenanceOrder[]>("/maintenance/orders");
  const { data: assets, mutate: mutateAssets } = useApi<Asset[]>("/maintenance/assets");
  const { data: kpis, mutate: mutateKpis } = useApi<MaintenanceKpis>("/maintenance/kpis");
  const { data: pmPlans, mutate: mutatePmPlans } = useApi<PmPlan[]>("/maintenance/pm-plans");

  const orderList = useMemo(() => (Array.isArray(orders) ? orders : []), [orders]);
  const assetList = useMemo(() => (Array.isArray(assets) ? assets : []), [assets]);
  const pmPlanList = useMemo(() => (Array.isArray(pmPlans) ? pmPlans : []), [pmPlans]);

  const [tab, setTab] = useState<Tab>("overview");
  const [orderModal, setOrderModal] = useState<{ prefill?: Partial<CreateOrderInput> } | null>(null);

  // Las órdenes ripplean a los KPIs; el estado del activo, también (assetsDown).
  const refreshOrders = () => { mutateOrders(); mutateKpis(); };
  const refreshAssets = () => { mutateAssets(); mutateKpis(); };
  // Generar una orden de PM toca planes + órdenes + KPIs.
  const refreshPreventive = () => { mutatePmPlans(); mutateOrders(); mutateKpis(); };

  const onNewOrder = (prefill?: Partial<CreateOrderInput>) => setOrderModal({ prefill });

  const backlog = useMemo(() => backlogCount(orderList), [orderList]);
  const pmActive = useMemo(() => pmPlanList.filter((p) => p.active).length, [pmPlanList]);

  if (forbidden) {
    return (
      <div className="min-h-screen grid place-items-center text-black dark:text-white">
        <div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}>
          <Lock className="w-8 h-8 mx-auto mb-3 text-gray-400" />
          <h2 className="text-lg font-semibold">Sin acceso</h2>
          <p className="text-sm text-gray-400 mt-1">Inicia sesión para ver mantenimiento.</p>
        </div>
      </div>
    );
  }

  const firstLoad = isLoading && orders === undefined;

  return (
    <div className="min-h-screen text-black dark:text-white">
      {/* Header + tabs (sticky) */}
      <div className={`${glass} sticky top-0 z-40 px-6 pt-4`}>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="p-2 -ml-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <span className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: `${COLORS.violet}1f` }}>
              <Wrench className="w-5 h-5" style={{ color: COLORS.violet }} />
            </span>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold leading-tight">Mantenimiento · TPM</h1>
              <p className="text-[12px] text-gray-400 leading-tight">Activos, órdenes y preventivo (CMMS)</p>
            </div>
            <button onClick={() => onNewOrder()} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white" style={{ background: COLORS.violet }}>
              <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Nueva orden</span>
            </button>
          </div>
          <div className="flex items-center gap-1 mt-3 -mx-1 px-1 pb-1 overflow-x-auto">
            <TabBtn active={tab === "overview"} onClick={() => setTab("overview")} icon={<Gauge className="w-4 h-4" />}>Resumen</TabBtn>
            <TabBtn active={tab === "assets"} onClick={() => setTab("assets")} icon={<HardDrive className="w-4 h-4" />} count={assetList.length}>Activos</TabBtn>
            <TabBtn active={tab === "orders"} onClick={() => setTab("orders")} icon={<ClipboardList className="w-4 h-4" />} count={backlog}>Órdenes</TabBtn>
            <TabBtn active={tab === "preventive"} onClick={() => setTab("preventive")} icon={<CalendarClock className="w-4 h-4" />} count={pmActive}>Preventivo</TabBtn>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 pt-6 pb-28">
        {firstLoad ? (
          <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : tab === "overview" ? (
          <OverviewTab
            kpis={kpis}
            orders={orderList}
            assets={assetList}
            onNewOrder={onNewOrder}
            onGoOrders={() => setTab("orders")}
            onGoPreventive={() => setTab("preventive")}
            refreshAssets={refreshAssets}
          />
        ) : tab === "assets" ? (
          <AssetsTab assets={assetList} orders={orderList} onNewOrder={onNewOrder} refresh={refreshAssets} />
        ) : tab === "orders" ? (
          <OrdersTab orders={orderList} assets={assetList} onNewOrder={onNewOrder} refresh={refreshOrders} />
        ) : (
          <PreventiveTab plans={pmPlanList} assets={assetList} kpis={kpis} refresh={refreshPreventive} />
        )}
      </main>

      {orderModal && (
        <OrderFormModal
          assets={assetList}
          prefill={orderModal.prefill}
          onClose={() => setOrderModal(null)}
          onCreated={refreshOrders}
        />
      )}

      {/* Estilos de inputs glass disponibles para filtros y drawer (no sólo modales). */}
      <MInputStyle />
    </div>
  );
}
