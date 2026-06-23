"use client";

// Citas de andén (Dock appointments) — the scheduling + gate log tab. A real
// table over /traffic/appointments (orden, filtro, búsqueda, export) with the
// gate lifecycle (programar → registrar llegada → registrar salida; cancelar /
// no-show), KPIs del día y un empty-state que invita. Reusa los primitivos del
// Workspace Industrial; el backend (traffic-appointment.rules) cuida el flujo.
import React, { useMemo, useState } from "react";
import {
  Ban,
  CalendarClock,
  CheckCircle2,
  LogIn,
  Pencil,
  Plus,
  XCircle,
} from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  DataTable,
  DetailDrawer,
  DrawerField,
  DrawerSection,
  EmptyState,
  ExportButton,
  FilterBar,
  KpiRow,
  type ExportColumn,
  type FilterDef,
  type FilterValues,
  type StatCardProps,
} from "@/components/workspace";
import { Pill } from "./traffic.ui";
import { AppointmentFormModal, DeleteButton, DockOpButton } from "./traffic.actions";
import {
  ACCENT,
  APPOINTMENT_DIRECTION_META,
  APPOINTMENT_STATUS_META,
  COLORS,
  fmtDateTime,
  isAppointmentLate,
  isToday,
} from "./traffic.utils";
import type {
  Appointment,
  AppointmentStatus,
  Carrier,
  Driver,
  LoadingDock,
  Vehicle,
} from "./traffic.types";

const NEW_BTN =
  "inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90";
const STATUS_ORDER: AppointmentStatus[] = ["scheduled", "arrived", "completed", "no_show", "cancelled"];

function LateBadge() {
  return <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: `${COLORS.red}1f`, color: COLORS.red }}>Tarde</span>;
}

export function AppointmentsTab({
  items,
  carriers,
  vehicles,
  drivers,
  docks,
  refresh,
}: {
  items: Appointment[];
  carriers: Carrier[];
  vehicles: Vehicle[];
  drivers: Driver[];
  docks: LoadingDock[];
  refresh: () => void;
}) {
  const [modal, setModal] = useState<null | { edit?: Appointment }>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterValues>({});
  const [exportRows, setExportRows] = useState<Appointment[]>(items);

  const selected = useMemo(() => items.find((a) => a.id === selectedId) ?? null, [items, selectedId]);

  const filtered = useMemo(() => {
    const statuses = (filters.status as string[] | undefined) ?? [];
    const direction = filters.direction as string | undefined;
    return items.filter((a) => {
      if (statuses.length && !statuses.includes(a.status)) return false;
      if (direction && a.direction !== direction) return false;
      return true;
    });
  }, [items, filters]);

  const kpis = useMemo(() => {
    let scheduled = 0, arrived = 0, late = 0, today = 0, completed = 0;
    for (const a of items) {
      if (a.status === "scheduled") scheduled++;
      if (a.status === "arrived") arrived++;
      if (a.status === "completed") completed++;
      if (isAppointmentLate(a)) late++;
      if (isToday(a.scheduledAt) && (a.status === "scheduled" || a.status === "arrived")) today++;
    }
    return { scheduled, arrived, late, today, completed };
  }, [items]);

  const kpiItems: StatCardProps[] = [
    { label: "Programadas", value: kpis.scheduled, color: COLORS.blue, icon: CalendarClock },
    { label: "Hoy", value: kpis.today, color: COLORS.indigo, icon: CalendarClock },
    { label: "En patio", value: kpis.arrived, color: COLORS.cyan, icon: LogIn },
    { label: "Tarde", value: kpis.late, color: kpis.late > 0 ? COLORS.red : COLORS.green, icon: XCircle },
    { label: "Completadas", value: kpis.completed, color: COLORS.green, icon: CheckCircle2 },
  ];

  const columns = useMemo<ColumnDef<Appointment, unknown>[]>(
    () => [
      {
        id: "scheduledAt",
        accessorFn: (a) => a.scheduledAt,
        header: "Programada",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="font-medium">{fmtDateTime(row.original.scheduledAt)}</span>
            {isAppointmentLate(row.original) && <LateBadge />}
          </div>
        ),
      },
      {
        accessorKey: "direction",
        header: "Tipo",
        cell: ({ row }) => <Pill label={APPOINTMENT_DIRECTION_META[row.original.direction].label} color={APPOINTMENT_DIRECTION_META[row.original.direction].color} />,
      },
      {
        accessorKey: "dockCode",
        header: "Andén",
        cell: ({ getValue }) => <span className="text-gray-600 dark:text-gray-300">{(getValue() as string) || "—"}</span>,
      },
      {
        accessorKey: "carrierName",
        header: "Transportista",
        cell: ({ getValue }) => <span className="text-gray-600 dark:text-gray-300">{(getValue() as string) || "—"}</span>,
        meta: { filterable: true, filterPlaceholder: "Transportista…" },
      },
      {
        accessorKey: "vehiclePlate",
        header: "Unidad",
        cell: ({ getValue }) => <span className="text-gray-500 dark:text-gray-400">{(getValue() as string) || "—"}</span>,
      },
      {
        accessorKey: "shipmentRef",
        header: "Embarque",
        cell: ({ getValue }) =>
          getValue() ? (
            <span className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-[10px] text-gray-500 dark:bg-white/10">{getValue() as string}</span>
          ) : (
            <span className="text-gray-400">—</span>
          ),
        meta: { filterable: true, filterPlaceholder: "Folio…" },
      },
      {
        id: "status",
        accessorFn: (a) => a.status,
        header: "Estado",
        cell: ({ row }) => <Pill label={APPOINTMENT_STATUS_META[row.original.status].label} color={APPOINTMENT_STATUS_META[row.original.status].color} dot />,
      },
      {
        id: "__actions",
        header: "",
        enableSorting: false,
        enableHiding: false,
        size: 48,
        meta: { align: "right" },
        cell: ({ row }) => (
          <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setModal({ edit: row.original })}
              title="Editar"
              className="rounded-lg p-1.5 text-gray-400 hover:bg-black/5 hover:text-black dark:hover:bg-white/10 dark:hover:text-white"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </div>
        ),
      },
    ],
    [],
  );

  const exportColumns = useMemo<ExportColumn<Appointment>[]>(
    () => [
      { key: "scheduledAt", header: "Programada", value: (a) => fmtDateTime(a.scheduledAt) },
      { key: "windowEnd", header: "Fin ventana", value: (a) => fmtDateTime(a.windowEnd) },
      { key: "direction", header: "Tipo", value: (a) => APPOINTMENT_DIRECTION_META[a.direction].label },
      { key: "dockCode", header: "Andén" },
      { key: "carrierName", header: "Transportista" },
      { key: "vehiclePlate", header: "Unidad" },
      { key: "driverName", header: "Chofer" },
      { key: "shipmentRef", header: "Embarque" },
      { key: "status", header: "Estado", value: (a) => APPOINTMENT_STATUS_META[a.status].label },
      { key: "arrivedAt", header: "Llegada", value: (a) => fmtDateTime(a.arrivedAt) },
      { key: "completedAt", header: "Salida", value: (a) => fmtDateTime(a.completedAt) },
      { key: "notes", header: "Notas" },
    ],
    [],
  );

  const FILTER_DEFS: FilterDef[] = [
    { key: "status", type: "pill", label: "Estado", options: STATUS_ORDER.map((s) => ({ value: s, label: APPOINTMENT_STATUS_META[s].label, color: APPOINTMENT_STATUS_META[s].color })) },
    { key: "direction", type: "select", label: "Tipo", options: [{ value: "outbound", label: "Embarque" }, { value: "inbound", label: "Recibo" }] },
  ];

  const closeDrawer = () => setSelectedId(null);
  const onDone = () => {
    refresh();
    closeDrawer();
  };

  return (
    <div className="space-y-5">
      <KpiRow items={kpiItems} columns={5} />

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setModal({})} className={NEW_BTN} style={{ background: ACCENT }}>
          <Plus className="h-4 w-4" /> Nueva cita
        </button>
        <FilterBar defs={FILTER_DEFS} value={filters} onChange={setFilters} />
        <div className="ml-auto">
          <ExportButton<Appointment> rows={exportRows} columns={exportColumns} filename="trafico-citas" />
        </div>
      </div>

      <DataTable<Appointment>
        data={filtered}
        columns={columns}
        getRowId={(a) => a.id}
        searchPlaceholder="Buscar cita (transportista, unidad, folio)…"
        onFilteredRowsChange={setExportRows}
        onRowClick={(a) => setSelectedId(a.id)}
        pageSize={10}
        emptyState={
          <EmptyState
            icon={CalendarClock}
            accent={ACCENT}
            title="Programa tu primera cita de andén"
            description="Las citas agendan qué transportista/unidad llega a qué andén y cuándo, y registran la entrada y salida de la unidad (gate-in / gate-out)."
            hint={[
              "Agenda llegadas y reduce filas en el patio.",
              "Registra entrada (en patio) y salida con un toque.",
              "Detecta citas tarde y no-shows de un vistazo.",
            ]}
            primaryAction={{ label: "Nueva cita", icon: Plus, onClick: () => setModal({}) }}
          />
        }
      />

      <DetailDrawer
        open={selected !== null}
        onClose={closeDrawer}
        icon={CalendarClock}
        accent={ACCENT}
        title={selected ? fmtDateTime(selected.scheduledAt) : "Cita"}
        subtitle={selected ? APPOINTMENT_DIRECTION_META[selected.direction].label : undefined}
        actions={
          selected && (
            <div className="flex w-full flex-wrap items-center justify-end gap-2">
              {selected.status === "scheduled" && (
                <>
                  <DockOpButton path={`/traffic/appointments/${selected.id}/arrive`} source="Cita" label="Registrar llegada" icon={<LogIn className="h-3.5 w-3.5" />} color={COLORS.indigo} onDone={onDone} />
                  <DockOpButton path={`/traffic/appointments/${selected.id}/no-show`} source="Cita" label="No-show" icon={<Ban className="h-3.5 w-3.5" />} color={COLORS.red} confirmMsg="¿Marcar la cita como no-show?" onDone={onDone} />
                </>
              )}
              {selected.status === "arrived" && (
                <DockOpButton path={`/traffic/appointments/${selected.id}/complete`} source="Cita" label="Registrar salida" icon={<CheckCircle2 className="h-3.5 w-3.5" />} color={COLORS.green} onDone={onDone} />
              )}
              {(selected.status === "scheduled" || selected.status === "arrived") && (
                <DockOpButton path={`/traffic/appointments/${selected.id}/cancel`} source="Cita" label="Cancelar" icon={<XCircle className="h-3.5 w-3.5" />} color={COLORS.gray} confirmMsg="¿Cancelar la cita?" onDone={onDone} />
              )}
              <button
                type="button"
                onClick={() => {
                  setModal({ edit: selected });
                  closeDrawer();
                }}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium"
                style={{ background: `${ACCENT}1f`, color: ACCENT }}
              >
                <Pencil className="h-4 w-4" /> Editar
              </button>
              <DeleteButton kind="appointments" id={selected.id} label="la cita" showText onDeleted={onDone} />
            </div>
          )
        }
      >
        {selected && (
          <DrawerSection title="Detalle">
            <DrawerField label="Estado">
              <span className="inline-flex items-center gap-1.5">
                <Pill label={APPOINTMENT_STATUS_META[selected.status].label} color={APPOINTMENT_STATUS_META[selected.status].color} dot />
                {isAppointmentLate(selected) && <LateBadge />}
              </span>
            </DrawerField>
            <DrawerField label="Tipo">{APPOINTMENT_DIRECTION_META[selected.direction].label}</DrawerField>
            <DrawerField label="Programada">{fmtDateTime(selected.scheduledAt)}</DrawerField>
            <DrawerField label="Fin ventana">{fmtDateTime(selected.windowEnd)}</DrawerField>
            <DrawerField label="Andén">{selected.dockCode || "—"}</DrawerField>
            <DrawerField label="Transportista">{selected.carrierName || "—"}</DrawerField>
            <DrawerField label="Unidad">{selected.vehiclePlate || "—"}</DrawerField>
            <DrawerField label="Chofer">{selected.driverName || "—"}</DrawerField>
            <DrawerField label="Embarque">{selected.shipmentRef || "—"}</DrawerField>
            <DrawerField label="Llegada (gate-in)">{fmtDateTime(selected.arrivedAt)}</DrawerField>
            <DrawerField label="Salida (gate-out)">{fmtDateTime(selected.completedAt)}</DrawerField>
            {selected.notes && <DrawerField label="Notas">{selected.notes}</DrawerField>}
          </DrawerSection>
        )}
      </DetailDrawer>

      {modal && (
        <AppointmentFormModal
          initial={modal.edit}
          carriers={carriers}
          vehicles={vehicles}
          drivers={drivers}
          docks={docks}
          onClose={() => setModal(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
