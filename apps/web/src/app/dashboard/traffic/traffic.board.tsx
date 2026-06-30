"use client";

// Tablero de andenes — the operational yard cockpit. A live, semaforized view of
// every dock (LIBRE / OCUPADO / EN CARGA / MANTENIMIENTO) with its occupant
// embarque/unit and aging, plus one-tap actions: asignar embarque, marcar/detener
// carga, registrar salida. Occupancy is DERIVED from the outbound shipments that
// reference each dock (the source of truth), so the board never diverges from the
// existing assign-transport flow; the dock's own status/occupiedAt/loadingStartedAt
// drive the semáforo and the aging clock.
import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  LogOut,
  PackageCheck,
  Pause,
  Play,
  RotateCcw,
  Truck,
  User,
  Warehouse,
} from "lucide-react";
import { glass } from "@/lib/glass";
import { KpiRow, EmptyState, type StatCardProps } from "@/components/workspace";
import { Pill } from "./traffic.ui";
import { BoardAssignModal, DockOpButton } from "./traffic.actions";
import {
  ACCENT,
  AGING_CRIT_MIN,
  COLORS,
  DOCK_BOARD_META,
  DOCK_BOARD_ORDER,
  DOCK_TYPE_META,
  agingColor,
  agingMinutes,
  deriveBoardState,
  fmtAging,
  fmtDateTime,
  isAppointmentLate,
  shipmentStatusMeta,
} from "./traffic.utils";
import type {
  Appointment,
  Carrier,
  Driver,
  LoadingDock,
  OutboundShipmentLite,
  Vehicle,
} from "./traffic.types";

const ACTIVE_SHIPMENT = (s: OutboundShipmentLite) =>
  !["SHIPPED", "DELIVERED", "CANCELLED"].includes(s.status);

function AgingChip({ label, iso }: { label: string; iso: string | null }) {
  const mins = agingMinutes(iso);
  if (mins == null) return null;
  const color = agingColor(mins);
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: `${color}1f`, color }}>
      {label} {fmtAging(mins)}
    </span>
  );
}

function DockCard({
  dock,
  occupant,
  nextAppt,
  onAssign,
  refresh,
}: {
  dock: LoadingDock;
  occupant: OutboundShipmentLite | null;
  nextAppt: Appointment | null;
  onAssign: (dock: LoadingDock) => void;
  refresh: () => void;
}) {
  const board = deriveBoardState(dock);
  const meta = DOCK_BOARD_META[board];
  const apptLate = nextAppt ? isAppointmentLate(nextAppt) : false;
  const release = occupant
    ? (
      <DockOpButton
        path={`/outbound/shipments/${occupant.id}/release-transport`}
        label="Registrar salida"
        icon={<LogOut className="h-3.5 w-3.5" />}
        color={COLORS.red}
        confirmMsg={`¿Liberar el andén ${dock.code} y registrar la salida de la unidad?`}
        onDone={refresh}
      />
    )
    : (
      <DockOpButton
        path={`/traffic/docks/${dock.id}`}
        method="PATCH"
        body={{ status: "available" }}
        label="Liberar"
        icon={<LogOut className="h-3.5 w-3.5" />}
        color={COLORS.red}
        onDone={refresh}
      />
    );

  return (
    <div className={`${glass} flex flex-col gap-3 rounded-2xl p-4`} style={{ borderLeft: `4px solid ${meta.color}` }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{dock.code}</span>
            <Pill label={meta.label} color={meta.color} dot />
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-gray-500 dark:text-gray-400">
            {dock.name && <span className="truncate">{dock.name}</span>}
            <Pill label={DOCK_TYPE_META[dock.type].label} color={DOCK_TYPE_META[dock.type].color} />
          </div>
        </div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: `${meta.color}1f`, color: meta.color }}>
          <Warehouse className="h-5 w-5" />
        </span>
      </div>

      {/* Occupant / aging */}
      {board === "occupied" || board === "loading" ? (
        <div className="rounded-xl bg-black/[0.03] p-2.5 dark:bg-white/[0.04]">
          {occupant ? (
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                {occupant.folio && (
                  <span className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-[10px] text-gray-500 dark:bg-white/10">{occupant.folio}</span>
                )}
                <span className="truncate text-sm font-medium">{occupant.customerName || occupant.title}</span>
                <Pill label={shipmentStatusMeta(occupant.status).label} color={shipmentStatusMeta(occupant.status).color} />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[12px] text-gray-500 dark:text-gray-400">
                {occupant.vehiclePlate && <span className="inline-flex items-center gap-1"><Truck className="h-3 w-3" />{occupant.vehiclePlate}</span>}
                {occupant.driverName && <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />{occupant.driverName}</span>}
                {occupant.carrier && <span>{occupant.carrier}</span>}
              </div>
            </div>
          ) : (
            <p className="text-[12px] italic text-gray-500 dark:text-gray-400">Ocupado (sin embarque ligado).</p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <AgingChip label="En andén" iso={dock.occupiedAt} />
            {board === "loading" && <AgingChip label="En carga" iso={dock.loadingStartedAt} />}
          </div>
        </div>
      ) : board === "free" ? (
        <p className="text-[12px] text-gray-500 dark:text-gray-400">Disponible para asignar un embarque.</p>
      ) : (
        <p className="text-[12px] text-gray-500 dark:text-gray-400">
          {board === "maintenance" ? "Fuera de servicio por mantenimiento." : "Andén inactivo."}
        </p>
      )}

      {/* Próxima cita agendada para este andén */}
      {nextAppt && (
        <div className="flex flex-wrap items-center gap-1.5 text-[12px]" style={{ color: apptLate ? COLORS.red : COLORS.gray }}>
          <CalendarClock className="h-3.5 w-3.5" />
          <span className="font-medium">{apptLate ? "Cita tarde" : "Próx. cita"}</span>
          <span>{fmtDateTime(nextAppt.scheduledAt)}</span>
          {(nextAppt.carrierName || nextAppt.vehiclePlate) && (
            <span className="text-gray-500 dark:text-gray-400">· {nextAppt.carrierName || nextAppt.vehiclePlate}</span>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        {board === "free" &&
          (dock.type === "receiving" ? (
            <span className="text-[12px] italic text-gray-500 dark:text-gray-400">Andén de recibo — no embarca.</span>
          ) : (
            <button
              type="button"
              onClick={() => onAssign(dock)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium"
              style={{ background: `${ACCENT}1f`, color: ACCENT }}
            >
              <PackageCheck className="h-3.5 w-3.5" /> Asignar embarque
            </button>
          ))}

        {board === "occupied" && (
          <>
            <DockOpButton path={`/traffic/docks/${dock.id}/start-loading`} label="Marcar en carga" icon={<Play className="h-3.5 w-3.5" />} color={COLORS.orange} onDone={refresh} />
            {release}
          </>
        )}

        {board === "loading" && (
          <>
            <DockOpButton path={`/traffic/docks/${dock.id}/stop-loading`} label="Detener carga" icon={<Pause className="h-3.5 w-3.5" />} color={COLORS.amber} onDone={refresh} />
            {release}
          </>
        )}

        {board === "maintenance" && (
          <DockOpButton
            path={`/traffic/docks/${dock.id}`}
            method="PATCH"
            body={{ status: "available" }}
            label="Reactivar"
            icon={<RotateCcw className="h-3.5 w-3.5" />}
            color={COLORS.green}
            onDone={refresh}
          />
        )}
      </div>
    </div>
  );
}

export function BoardTab({
  docks,
  shipments,
  appointments,
  carriers,
  vehicles,
  drivers,
  refresh,
  onNewDock,
}: {
  docks: LoadingDock[];
  shipments: OutboundShipmentLite[];
  appointments: Appointment[];
  carriers: Carrier[];
  vehicles: Vehicle[];
  drivers: Driver[];
  refresh: () => void;
  onNewDock: () => void;
}) {
  const [assignDock, setAssignDock] = useState<LoadingDock | null>(null);

  // Map each dock to the active shipment that occupies it (the source of truth).
  const occByDock = useMemo(() => {
    const m = new Map<string, OutboundShipmentLite>();
    for (const s of shipments) {
      if (s.dockId && s.transportAssignedAt && ACTIVE_SHIPMENT(s)) m.set(s.dockId, s);
    }
    return m;
  }, [shipments]);

  // Map each dock to its next still-open appointment (earliest scheduled/arrived).
  const nextApptByDock = useMemo(() => {
    const m = new Map<string, Appointment>();
    const open = appointments
      .filter((a) => a.dockId && (a.status === "scheduled" || a.status === "arrived"))
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
    for (const a of open) if (a.dockId && !m.has(a.dockId)) m.set(a.dockId, a);
    return m;
  }, [appointments]);

  const sorted = useMemo(
    () =>
      [...docks].sort((a, b) => {
        const d = DOCK_BOARD_ORDER.indexOf(deriveBoardState(a)) - DOCK_BOARD_ORDER.indexOf(deriveBoardState(b));
        return d !== 0 ? d : a.code.localeCompare(b.code);
      }),
    [docks],
  );

  const kpis = useMemo(() => {
    let free = 0, occupied = 0, loading = 0, maintenance = 0;
    const agings: number[] = [];
    for (const k of docks) {
      const b = deriveBoardState(k);
      if (b === "free") free++;
      else if (b === "occupied") occupied++;
      else if (b === "loading") loading++;
      else if (b === "maintenance") maintenance++;
      if (b === "occupied" || b === "loading") {
        const m = agingMinutes(k.occupiedAt);
        if (m != null) agings.push(m);
      }
    }
    const enPatio = shipments.filter((s) => s.dockId && s.transportAssignedAt && ACTIVE_SHIPMENT(s)).length;
    const unidadesEspera = vehicles.filter((v) => v.status === "assigned").length;
    const agingProm = agings.length ? Math.round(agings.reduce((a, b) => a + b, 0) / agings.length) : null;
    return { free, occupied, loading, maintenance, enPatio, unidadesEspera, agingProm };
  }, [docks, shipments, vehicles]);

  // Indicadores/alertas derivados (sobreestadía + embarques sin andén).
  const overstay = useMemo(
    () => sorted.filter((k) => (deriveBoardState(k) === "occupied" || deriveBoardState(k) === "loading") && (agingMinutes(k.occupiedAt) ?? 0) >= AGING_CRIT_MIN),
    [sorted],
  );
  const sinAnden = useMemo(
    () => shipments.filter((s) => !s.dockId && ["PACKING", "READY"].includes(s.status)),
    [shipments],
  );

  const kpiItems: StatCardProps[] = [
    { label: "Andenes libres", value: kpis.free, color: COLORS.green, icon: Warehouse },
    { label: "Andenes ocupados", value: kpis.occupied + kpis.loading, sublabel: `${kpis.loading} en carga`, color: COLORS.indigo, icon: Truck },
    { label: "Embarques en patio", value: kpis.enPatio, color: COLORS.blue, icon: PackageCheck },
    { label: "Unidades en espera", value: kpis.unidadesEspera, color: COLORS.cyan, icon: Truck },
    { label: "Aging promedio", value: kpis.agingProm == null ? "—" : fmtAging(kpis.agingProm), color: agingColor(kpis.agingProm), icon: AlertTriangle },
  ];

  if (docks.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        accent={ACCENT}
        title="Arma tu Tablero de andenes"
        description="El tablero muestra en vivo qué andén está libre, ocupado o en carga, con su embarque y antigüedad. Registra tu primer andén para empezar a operarlo."
        hint={[
          "Semáforo de patio: libre / ocupado / en carga / mantenimiento.",
          "Asigna embarques y registra entradas/salidas con un toque.",
          "Aging por andén con umbrales para detectar sobreestadía.",
        ]}
        primaryAction={{ label: "Nuevo andén", icon: Building2, onClick: onNewDock }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <KpiRow items={kpiItems} columns={5} />

      {(overstay.length > 0 || sinAnden.length > 0) && (
        <div className={`${glass} rounded-2xl p-4`}>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4" style={{ color: COLORS.amber }} /> Alertas de patio
          </div>
          <div className="flex flex-wrap gap-2">
            {overstay.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium" style={{ background: `${COLORS.red}1f`, color: COLORS.red }}>
                {overstay.length} andén{overstay.length === 1 ? "" : "es"} con sobreestadía (&gt; {fmtAging(AGING_CRIT_MIN)})
              </span>
            )}
            {sinAnden.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium" style={{ background: `${COLORS.amber}1f`, color: COLORS.amber }}>
                {sinAnden.length} embarque{sinAnden.length === 1 ? "" : "s"} activo{sinAnden.length === 1 ? "" : "s"} sin andén
              </span>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((k) => (
          <DockCard key={k.id} dock={k} occupant={occByDock.get(k.id) ?? null} nextAppt={nextApptByDock.get(k.id) ?? null} onAssign={setAssignDock} refresh={refresh} />
        ))}
      </div>

      {assignDock && (
        <BoardAssignModal
          dock={assignDock}
          shipments={shipments}
          carriers={carriers}
          vehicles={vehicles}
          drivers={drivers}
          onClose={() => setAssignDock(null)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}
