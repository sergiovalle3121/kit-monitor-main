"use client";

// Traffic (Tráfico) — logistics master data + transport assignment for the EMS
// shipping suite. One screen, tabbed: the four catalogs (carriers, vehicles,
// drivers, docks) over the real `traffic` module, plus an assignment view that
// ties carrier/unit/driver/dock to an outbound shipment (poka-yoke enforced by
// the backend). Phase 1 of the shipping suite ("maestros primero").
import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Building2, CalendarClock, ChevronLeft, LayoutDashboard, Loader2, Lock, PackageCheck, Truck, User, Warehouse } from "lucide-react";
import { glass } from "@/lib/glass";
import { useApi } from "@/hooks/useApi";
import { TabBtn, TrfInputStyle } from "./traffic.ui";
import {
  AssignmentTab,
  CarriersTab,
  DocksTab,
  DriversTab,
  VehiclesTab,
} from "./traffic.masters";
import { BoardTab } from "./traffic.board";
import { AppointmentsTab } from "./traffic.appointments";
import { ACCENT } from "./traffic.utils";
import type {
  Appointment,
  Carrier,
  Driver,
  LoadingDock,
  OutboundShipmentLite,
  Vehicle,
} from "./traffic.types";

type Tab = "board" | "carriers" | "vehicles" | "drivers" | "docks" | "appointments" | "assignment";

export default function TrafficPage() {
  const carriersApi = useApi<Carrier[]>("/traffic/carriers");
  const vehiclesApi = useApi<Vehicle[]>("/traffic/vehicles");
  const driversApi = useApi<Driver[]>("/traffic/drivers");
  const docksApi = useApi<LoadingDock[]>("/traffic/docks");
  const shipmentsApi = useApi<OutboundShipmentLite[]>("/outbound/shipments");
  const appointmentsApi = useApi<Appointment[]>("/traffic/appointments");

  const carriers = useMemo(() => (Array.isArray(carriersApi.data) ? carriersApi.data : []), [carriersApi.data]);
  const vehicles = useMemo(() => (Array.isArray(vehiclesApi.data) ? vehiclesApi.data : []), [vehiclesApi.data]);
  const drivers = useMemo(() => (Array.isArray(driversApi.data) ? driversApi.data : []), [driversApi.data]);
  const docks = useMemo(() => (Array.isArray(docksApi.data) ? docksApi.data : []), [docksApi.data]);
  const shipments = useMemo(() => (Array.isArray(shipmentsApi.data) ? shipmentsApi.data : []), [shipmentsApi.data]);
  const appointments = useMemo(() => (Array.isArray(appointmentsApi.data) ? appointmentsApi.data : []), [appointmentsApi.data]);

  const [tab, setTab] = useState<Tab>("board");

  // Una asignación mueve estatus de unidad/chofer/andén y el embarque: refresca todo.
  const refreshAll = () => {
    carriersApi.mutate();
    vehiclesApi.mutate();
    driversApi.mutate();
    docksApi.mutate();
    shipmentsApi.mutate();
    appointmentsApi.mutate();
  };

  if (carriersApi.forbidden) {
    return (
      <div className="min-h-screen grid place-items-center text-foreground">
        <div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}>
          <Lock className="w-8 h-8 mx-auto mb-3 text-gray-400" />
          <h2 className="text-lg font-semibold">Sin acceso</h2>
          <p className="text-sm text-gray-400 mt-1">Necesitas permiso de logística para ver tráfico.</p>
        </div>
      </div>
    );
  }

  const firstLoad = carriersApi.isLoading && carriersApi.data === undefined;

  return (
    <div className="min-h-screen text-foreground">
      {/* Header + tabs (sticky) */}
      <div className={`${glass} sticky top-0 z-40 px-6 pt-4`}>
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="p-2 -ml-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <span className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: `${ACCENT}1f` }}>
              <Truck className="w-5 h-5" style={{ color: ACCENT }} />
            </span>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold leading-tight">Logística · Tráfico</h1>
              <p className="text-[12px] text-gray-400 leading-tight">Patio, maestros, citas y asignación de embarques</p>
            </div>
          </div>
          <div className="flex items-center gap-1 mt-3 -mx-1 px-1 pb-1 overflow-x-auto">
            <TabBtn active={tab === "board"} onClick={() => setTab("board")} icon={<LayoutDashboard className="w-4 h-4" />} count={docks.length}>Patio</TabBtn>
            <TabBtn active={tab === "carriers"} onClick={() => setTab("carriers")} icon={<Building2 className="w-4 h-4" />} count={carriers.length}>Transportistas</TabBtn>
            <TabBtn active={tab === "vehicles"} onClick={() => setTab("vehicles")} icon={<Truck className="w-4 h-4" />} count={vehicles.length}>Unidades</TabBtn>
            <TabBtn active={tab === "drivers"} onClick={() => setTab("drivers")} icon={<User className="w-4 h-4" />} count={drivers.length}>Choferes</TabBtn>
            <TabBtn active={tab === "docks"} onClick={() => setTab("docks")} icon={<Warehouse className="w-4 h-4" />} count={docks.length}>Andenes</TabBtn>
            <TabBtn active={tab === "appointments"} onClick={() => setTab("appointments")} icon={<CalendarClock className="w-4 h-4" />} count={appointments.length}>Citas</TabBtn>
            <TabBtn active={tab === "assignment"} onClick={() => setTab("assignment")} icon={<PackageCheck className="w-4 h-4" />}>Asignación</TabBtn>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 pt-6 pb-28">
        {firstLoad ? (
          <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : tab === "board" ? (
          <BoardTab docks={docks} shipments={shipments} appointments={appointments} carriers={carriers} vehicles={vehicles} drivers={drivers} refresh={refreshAll} onNewDock={() => setTab("docks")} />
        ) : tab === "carriers" ? (
          <CarriersTab items={carriers} vehicles={vehicles} drivers={drivers} refresh={refreshAll} />
        ) : tab === "vehicles" ? (
          <VehiclesTab items={vehicles} carriers={carriers} refresh={refreshAll} />
        ) : tab === "drivers" ? (
          <DriversTab items={drivers} carriers={carriers} refresh={refreshAll} />
        ) : tab === "docks" ? (
          <DocksTab items={docks} refresh={refreshAll} />
        ) : tab === "appointments" ? (
          <AppointmentsTab items={appointments} carriers={carriers} vehicles={vehicles} drivers={drivers} docks={docks} refresh={refreshAll} />
        ) : (
          <AssignmentTab shipments={shipments} carriers={carriers} vehicles={vehicles} drivers={drivers} docks={docks} refresh={refreshAll} />
        )}
      </main>

      <TrfInputStyle />
    </div>
  );
}
