"use client";

// The five tab views of the traffic lane: the four master catalogs (carriers,
// vehicles, drivers, docks) — now real industrial tables (orden, filtro,
// búsqueda, paginación, export, detalle) over the shared Workspace primitives —
// and the assignment view that ties transport to an outbound shipment.
import React, { useMemo, useState, type ReactNode } from "react";
import {
  Building2,
  Inbox,
  PackageCheck,
  Pencil,
  Plus,
  Search,
  Truck,
  User,
  Warehouse,
} from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { LucideIcon } from "lucide-react";
import { glass } from "@/lib/glass";
import {
  DataTable,
  DetailDrawer,
  DrawerField,
  DrawerSection,
  EmptyState,
  ExportButton,
  type ExportColumn,
} from "@/components/workspace";
import { ActionButton, Pill, StatusChip } from "./traffic.ui";
import {
  AssignTransportModal,
  CarrierFormModal,
  DeleteButton,
  DockFormModal,
  DriverFormModal,
  VehicleFormModal,
} from "./traffic.actions";
import {
  ACCENT,
  CARRIER_MODE_META,
  CARRIER_STATUS_META,
  COLORS,
  DOCK_BOARD_META,
  DOCK_TYPE_META,
  DRIVER_STATUS_META,
  SHIPMENT_PROGRESS,
  VEHICLE_STATUS_META,
  VEHICLE_TYPE_META,
  agingColor,
  agingMinutes,
  deriveBoardState,
  fmtAging,
  fmtDateTime,
  shipmentStatusMeta,
} from "./traffic.utils";
import type {
  Carrier,
  Driver,
  LoadingDock,
  MasterKind,
  OutboundShipmentLite,
  Vehicle,
} from "./traffic.types";

const NEW_BTN =
  "inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90";

function MonoCode({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 rounded bg-black/5 px-1.5 py-0.5 font-mono text-[10px] text-gray-500 dark:bg-white/10">
      {children}
    </span>
  );
}

// ── Generic catalog shell ────────────────────────────────────────────────────
// One table to rule the four masters: New + Export toolbar, the shared DataTable
// (sort/search/column-filters/pagination), an inviting EmptyState, a row-click
// DetailDrawer and the per-kind create/edit modal. CRUD lives in traffic.actions.
interface CatalogTableProps<T extends { id: string }> {
  rows: T[];
  columns: ColumnDef<T, unknown>[];
  exportColumns: ExportColumn<T>[];
  filename: string;
  newLabel: string;
  searchPlaceholder: string;
  empty: { icon: LucideIcon; title: string; description: string; hint?: string[] };
  kind: MasterKind;
  labelOf: (row: T) => string;
  detailIcon: LucideIcon;
  detailSubtitle?: (row: T) => string | undefined;
  renderForm: (p: { initial?: T; onClose: () => void; onSaved: () => void }) => ReactNode;
  renderDetail?: (row: T) => ReactNode;
  refresh: () => void;
}

function CatalogTable<T extends { id: string }>({
  rows,
  columns,
  exportColumns,
  filename,
  newLabel,
  searchPlaceholder,
  empty,
  kind,
  labelOf,
  detailIcon,
  detailSubtitle,
  renderForm,
  renderDetail,
  refresh,
}: CatalogTableProps<T>) {
  const [modal, setModal] = useState<null | { edit?: T }>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [exportRows, setExportRows] = useState<T[]>(rows);
  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);

  const allColumns = useMemo<ColumnDef<T, unknown>[]>(() => {
    const actions: ColumnDef<T, unknown> = {
      id: "__actions",
      header: "",
      enableSorting: false,
      enableHiding: false,
      size: 84,
      meta: { align: "right" },
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setModal({ edit: row.original })}
            title="Editar"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-black/5 hover:text-black dark:hover:bg-white/10 dark:hover:text-white"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <DeleteButton kind={kind} id={row.original.id} label={labelOf(row.original)} onDeleted={refresh} />
        </div>
      ),
    };
    return [...columns, actions];
  }, [columns, kind, labelOf, refresh]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <button type="button" onClick={() => setModal({})} className={NEW_BTN} style={{ background: ACCENT }}>
          <Plus className="h-4 w-4" /> {newLabel}
        </button>
        <ExportButton<T> rows={exportRows} columns={exportColumns} filename={filename} />
      </div>

      <DataTable<T>
        data={rows}
        columns={allColumns}
        getRowId={(r) => r.id}
        searchPlaceholder={searchPlaceholder}
        onFilteredRowsChange={setExportRows}
        onRowClick={renderDetail ? (r) => setSelectedId(r.id) : undefined}
        pageSize={10}
        emptyState={
          <EmptyState
            icon={empty.icon}
            accent={ACCENT}
            title={empty.title}
            description={empty.description}
            hint={empty.hint}
            primaryAction={{ label: newLabel, icon: Plus, onClick: () => setModal({}) }}
          />
        }
      />

      {renderDetail && (
        <DetailDrawer
          open={selected !== null}
          onClose={() => setSelectedId(null)}
          icon={detailIcon}
          accent={ACCENT}
          title={selected ? labelOf(selected) : ""}
          subtitle={selected && detailSubtitle ? detailSubtitle(selected) : undefined}
          actions={
            selected && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setModal({ edit: selected });
                    setSelectedId(null);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium"
                  style={{ background: `${ACCENT}1f`, color: ACCENT }}
                >
                  <Pencil className="h-4 w-4" /> Editar
                </button>
                <DeleteButton
                  kind={kind}
                  id={selected.id}
                  label={labelOf(selected)}
                  showText
                  onDeleted={() => {
                    refresh();
                    setSelectedId(null);
                  }}
                />
              </>
            )
          }
        >
          {selected && renderDetail(selected)}
        </DetailDrawer>
      )}

      {modal && renderForm({ initial: modal.edit, onClose: () => setModal(null), onSaved: refresh })}
    </div>
  );
}

// ── Carriers ─────────────────────────────────────────────────────────────────
export function CarriersTab({
  items,
  vehicles,
  drivers,
  refresh,
}: {
  items: Carrier[];
  vehicles: Vehicle[];
  drivers: Driver[];
  refresh: () => void;
}) {
  const columns = useMemo<ColumnDef<Carrier, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Transportista",
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-2">
            <MonoCode>{row.original.code}</MonoCode>
            <span className="truncate font-medium">{row.original.name}</span>
          </div>
        ),
        meta: { filterable: true, filterPlaceholder: "Nombre o código…" },
      },
      {
        accessorKey: "mode",
        header: "Modo",
        cell: ({ row }) => <Pill label={CARRIER_MODE_META[row.original.mode].label} color={CARRIER_MODE_META[row.original.mode].color} />,
      },
      {
        accessorKey: "scac",
        header: "SCAC",
        cell: ({ getValue }) => <span className="text-gray-500 dark:text-gray-400">{(getValue() as string) || "—"}</span>,
      },
      {
        accessorKey: "contactName",
        header: "Contacto",
        cell: ({ row }) => (
          <span className="text-gray-600 dark:text-gray-300">
            {row.original.contactName || "—"}
            {row.original.contactPhone ? ` · ${row.original.contactPhone}` : ""}
          </span>
        ),
      },
      {
        id: "status",
        accessorFn: (c) => c.status,
        header: "Estatus",
        cell: ({ row }) => <Pill label={CARRIER_STATUS_META[row.original.status].label} color={CARRIER_STATUS_META[row.original.status].color} dot />,
      },
    ],
    [],
  );

  const exportColumns = useMemo<ExportColumn<Carrier>[]>(
    () => [
      { key: "code", header: "Código" },
      { key: "name", header: "Nombre" },
      { key: "mode", header: "Modo", value: (c) => CARRIER_MODE_META[c.mode].label },
      { key: "scac", header: "SCAC" },
      { key: "taxId", header: "RFC / Tax ID" },
      { key: "status", header: "Estatus", value: (c) => CARRIER_STATUS_META[c.status].label },
      { key: "contactName", header: "Contacto" },
      { key: "contactPhone", header: "Teléfono" },
      { key: "contactEmail", header: "Email" },
      { key: "notes", header: "Notas" },
    ],
    [],
  );

  return (
    <CatalogTable<Carrier>
      rows={items}
      columns={columns}
      exportColumns={exportColumns}
      filename="trafico-transportistas"
      newLabel="Nuevo transportista"
      searchPlaceholder="Buscar transportista…"
      kind="carriers"
      labelOf={(c) => c.name}
      detailIcon={Truck}
      detailSubtitle={(c) => c.code}
      refresh={refresh}
      empty={{
        icon: Truck,
        title: "Da de alta tu primer transportista",
        description: "Los transportistas (carriers) son las empresas que mueven tus embarques. Su catálogo alimenta la asignación de transporte y el tablero de andenes.",
        hint: [
          "Liga unidades y choferes a cada transportista.",
          "Sólo los transportistas activos pueden asignarse a un embarque.",
          "Guarda SCAC, RFC y contacto para la Carta Porte.",
        ],
      }}
      renderForm={({ initial, onClose, onSaved }) => (
        <CarrierFormModal initial={initial} onClose={onClose} onSaved={onSaved} />
      )}
      renderDetail={(c) => {
        const units = vehicles.filter((v) => v.carrierId === c.id);
        const ops = drivers.filter((d) => d.carrierId === c.id);
        return (
          <>
            <DrawerSection title="Detalle">
              <DrawerField label="Código">{c.code}</DrawerField>
              <DrawerField label="Modo">
                <Pill label={CARRIER_MODE_META[c.mode].label} color={CARRIER_MODE_META[c.mode].color} />
              </DrawerField>
              <DrawerField label="Estatus">
                <Pill label={CARRIER_STATUS_META[c.status].label} color={CARRIER_STATUS_META[c.status].color} dot />
              </DrawerField>
              <DrawerField label="SCAC">{c.scac || "—"}</DrawerField>
              <DrawerField label="RFC / Tax ID">{c.taxId || "—"}</DrawerField>
              <DrawerField label="Contacto">{c.contactName || "—"}</DrawerField>
              <DrawerField label="Teléfono">{c.contactPhone || "—"}</DrawerField>
              <DrawerField label="Email">{c.contactEmail || "—"}</DrawerField>
              {c.notes && <DrawerField label="Notas">{c.notes}</DrawerField>}
            </DrawerSection>
            <DrawerSection title={`Unidades (${units.length})`}>
              {units.length === 0 ? (
                <p className="text-sm text-gray-400">Sin unidades ligadas.</p>
              ) : (
                <div className="space-y-1.5">
                  {units.map((v) => (
                    <div key={v.id} className={`${glass} flex items-center justify-between gap-2 rounded-xl p-2.5`}>
                      <span className="flex items-center gap-2 text-sm"><Truck className="h-3.5 w-3.5 text-gray-400" /> {v.plate}</span>
                      <Pill label={VEHICLE_STATUS_META[v.status].label} color={VEHICLE_STATUS_META[v.status].color} dot />
                    </div>
                  ))}
                </div>
              )}
            </DrawerSection>
            <DrawerSection title={`Choferes (${ops.length})`}>
              {ops.length === 0 ? (
                <p className="text-sm text-gray-400">Sin choferes ligados.</p>
              ) : (
                <div className="space-y-1.5">
                  {ops.map((d) => (
                    <div key={d.id} className={`${glass} flex items-center justify-between gap-2 rounded-xl p-2.5`}>
                      <span className="flex items-center gap-2 text-sm"><User className="h-3.5 w-3.5 text-gray-400" /> {d.name}</span>
                      <Pill label={DRIVER_STATUS_META[d.status].label} color={DRIVER_STATUS_META[d.status].color} dot />
                    </div>
                  ))}
                </div>
              )}
            </DrawerSection>
          </>
        );
      }}
    />
  );
}

// ── Vehicles ─────────────────────────────────────────────────────────────────
export function VehiclesTab({ items, carriers, refresh }: { items: Vehicle[]; carriers: Carrier[]; refresh: () => void }) {
  const columns = useMemo<ColumnDef<Vehicle, unknown>[]>(
    () => [
      {
        accessorKey: "plate",
        header: "Placa",
        cell: ({ row }) => <span className="font-medium">{row.original.plate}</span>,
        meta: { filterable: true, filterPlaceholder: "Placa…" },
      },
      {
        accessorKey: "type",
        header: "Tipo",
        cell: ({ row }) => <Pill label={VEHICLE_TYPE_META[row.original.type].label} color={VEHICLE_TYPE_META[row.original.type].color} />,
      },
      {
        accessorKey: "economicNumber",
        header: "Económico",
        cell: ({ getValue }) => <span className="text-gray-500 dark:text-gray-400">{(getValue() as string) || "—"}</span>,
      },
      {
        accessorKey: "carrierName",
        header: "Transportista",
        cell: ({ getValue }) => <span className="text-gray-600 dark:text-gray-300">{(getValue() as string) || "—"}</span>,
        meta: { filterable: true, filterPlaceholder: "Transportista…" },
      },
      {
        id: "maxWeightKg",
        accessorFn: (v) => v.maxWeightKg ?? 0,
        header: "Capacidad",
        cell: ({ row }) => <span className="tabular-nums">{row.original.maxWeightKg != null ? `${row.original.maxWeightKg} kg` : "—"}</span>,
        meta: { align: "right" },
      },
      {
        id: "status",
        accessorFn: (v) => v.status,
        header: "Estatus",
        cell: ({ row }) => <Pill label={VEHICLE_STATUS_META[row.original.status].label} color={VEHICLE_STATUS_META[row.original.status].color} dot />,
      },
    ],
    [],
  );

  const exportColumns = useMemo<ExportColumn<Vehicle>[]>(
    () => [
      { key: "plate", header: "Placa" },
      { key: "economicNumber", header: "Económico" },
      { key: "type", header: "Tipo", value: (v) => VEHICLE_TYPE_META[v.type].label },
      { key: "carrierName", header: "Transportista" },
      { key: "maxWeightKg", header: "Capacidad (kg)" },
      { key: "maxVolumeM3", header: "Volumen (m³)" },
      { key: "vin", header: "VIN" },
      { key: "status", header: "Estatus", value: (v) => VEHICLE_STATUS_META[v.status].label },
      { key: "notes", header: "Notas" },
    ],
    [],
  );

  return (
    <CatalogTable<Vehicle>
      rows={items}
      columns={columns}
      exportColumns={exportColumns}
      filename="trafico-unidades"
      newLabel="Nueva unidad"
      searchPlaceholder="Buscar unidad (placa, económico)…"
      kind="vehicles"
      labelOf={(v) => v.plate}
      detailIcon={Truck}
      detailSubtitle={(v) => VEHICLE_TYPE_META[v.type].label}
      refresh={refresh}
      empty={{
        icon: Truck,
        title: "Registra tu primera unidad",
        description: "Las unidades (vehículos) son las cajas/tractos que cargan tus embarques. Su tipo, capacidad y estatus gobiernan la asignación de transporte.",
        hint: [
          "Captura placa, económico, tipo y capacidad.",
          "Sólo las unidades disponibles pueden asignarse.",
          "La placa es única dentro de la planta.",
        ],
      }}
      renderForm={({ initial, onClose, onSaved }) => (
        <VehicleFormModal initial={initial} carriers={carriers} onClose={onClose} onSaved={onSaved} />
      )}
      renderDetail={(v) => (
        <DrawerSection title="Detalle">
          <DrawerField label="Placa">{v.plate}</DrawerField>
          <DrawerField label="Tipo">
            <Pill label={VEHICLE_TYPE_META[v.type].label} color={VEHICLE_TYPE_META[v.type].color} />
          </DrawerField>
          <DrawerField label="Estatus">
            <Pill label={VEHICLE_STATUS_META[v.status].label} color={VEHICLE_STATUS_META[v.status].color} dot />
          </DrawerField>
          <DrawerField label="Económico">{v.economicNumber || "—"}</DrawerField>
          <DrawerField label="Transportista">{v.carrierName || "—"}</DrawerField>
          <DrawerField label="Capacidad">{v.maxWeightKg != null ? `${v.maxWeightKg} kg` : "—"}</DrawerField>
          <DrawerField label="Volumen">{v.maxVolumeM3 != null ? `${v.maxVolumeM3} m³` : "—"}</DrawerField>
          <DrawerField label="VIN">{v.vin || "—"}</DrawerField>
          {v.notes && <DrawerField label="Notas">{v.notes}</DrawerField>}
        </DrawerSection>
      )}
    />
  );
}

// ── Drivers ──────────────────────────────────────────────────────────────────
export function DriversTab({ items, carriers, refresh }: { items: Driver[]; carriers: Carrier[]; refresh: () => void }) {
  const columns = useMemo<ColumnDef<Driver, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Chofer",
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
        meta: { filterable: true, filterPlaceholder: "Nombre…" },
      },
      {
        accessorKey: "licenseNumber",
        header: "Licencia",
        cell: ({ row }) => (
          <span className="text-gray-600 dark:text-gray-300">
            {row.original.licenseNumber || "—"}
            {row.original.licenseType ? ` (${row.original.licenseType})` : ""}
          </span>
        ),
      },
      {
        accessorKey: "phone",
        header: "Teléfono",
        cell: ({ getValue }) => <span className="text-gray-500 dark:text-gray-400">{(getValue() as string) || "—"}</span>,
      },
      {
        accessorKey: "carrierName",
        header: "Transportista",
        cell: ({ getValue }) => <span className="text-gray-600 dark:text-gray-300">{(getValue() as string) || "—"}</span>,
        meta: { filterable: true, filterPlaceholder: "Transportista…" },
      },
      {
        id: "status",
        accessorFn: (d) => d.status,
        header: "Estatus",
        cell: ({ row }) => <Pill label={DRIVER_STATUS_META[row.original.status].label} color={DRIVER_STATUS_META[row.original.status].color} dot />,
      },
    ],
    [],
  );

  const exportColumns = useMemo<ExportColumn<Driver>[]>(
    () => [
      { key: "name", header: "Nombre" },
      { key: "licenseNumber", header: "Licencia" },
      { key: "licenseType", header: "Tipo licencia" },
      { key: "phone", header: "Teléfono" },
      { key: "idDocument", header: "Identificación" },
      { key: "carrierName", header: "Transportista" },
      { key: "status", header: "Estatus", value: (d) => DRIVER_STATUS_META[d.status].label },
      { key: "notes", header: "Notas" },
    ],
    [],
  );

  return (
    <CatalogTable<Driver>
      rows={items}
      columns={columns}
      exportColumns={exportColumns}
      filename="trafico-choferes"
      newLabel="Nuevo chofer"
      searchPlaceholder="Buscar chofer…"
      kind="drivers"
      labelOf={(d) => d.name}
      detailIcon={User}
      detailSubtitle={(d) => d.carrierName ?? undefined}
      refresh={refresh}
      empty={{
        icon: User,
        title: "Da de alta tu primer chofer",
        description: "Los choferes (operadores) llevan tus unidades. Guarda licencia e identificación para verificarlos en el gate y asignarlos a un embarque.",
        hint: [
          "Captura licencia, tipo, teléfono e INE.",
          "Sólo los choferes disponibles pueden asignarse.",
          "Ligalos opcionalmente a un transportista.",
        ],
      }}
      renderForm={({ initial, onClose, onSaved }) => (
        <DriverFormModal initial={initial} carriers={carriers} onClose={onClose} onSaved={onSaved} />
      )}
      renderDetail={(d) => (
        <DrawerSection title="Detalle">
          <DrawerField label="Nombre">{d.name}</DrawerField>
          <DrawerField label="Estatus">
            <Pill label={DRIVER_STATUS_META[d.status].label} color={DRIVER_STATUS_META[d.status].color} dot />
          </DrawerField>
          <DrawerField label="Licencia">{d.licenseNumber || "—"}</DrawerField>
          <DrawerField label="Tipo licencia">{d.licenseType || "—"}</DrawerField>
          <DrawerField label="Teléfono">{d.phone || "—"}</DrawerField>
          <DrawerField label="Identificación">{d.idDocument || "—"}</DrawerField>
          <DrawerField label="Transportista">{d.carrierName || "—"}</DrawerField>
          {d.notes && <DrawerField label="Notas">{d.notes}</DrawerField>}
        </DrawerSection>
      )}
    />
  );
}

// ── Docks ────────────────────────────────────────────────────────────────────
export function DocksTab({ items, refresh }: { items: LoadingDock[]; refresh: () => void }) {
  const columns = useMemo<ColumnDef<LoadingDock, unknown>[]>(
    () => [
      {
        accessorKey: "code",
        header: "Andén",
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-2">
            <span className="font-medium">{row.original.code}</span>
            {row.original.name && <span className="truncate text-gray-500 dark:text-gray-400">{row.original.name}</span>}
          </div>
        ),
        meta: { filterable: true, filterPlaceholder: "Código o nombre…" },
      },
      {
        accessorKey: "type",
        header: "Tipo",
        cell: ({ row }) => <Pill label={DOCK_TYPE_META[row.original.type].label} color={DOCK_TYPE_META[row.original.type].color} />,
      },
      {
        accessorKey: "buildingName",
        header: "Edificio",
        cell: ({ getValue }) => <span className="text-gray-500 dark:text-gray-400">{(getValue() as string) || "—"}</span>,
      },
      {
        id: "board",
        accessorFn: (k) => deriveBoardState(k),
        header: "Estado",
        cell: ({ row }) => {
          const m = DOCK_BOARD_META[deriveBoardState(row.original)];
          return <Pill label={m.label} color={m.color} dot />;
        },
      },
      {
        id: "aging",
        accessorFn: (k) => agingMinutes(k.occupiedAt) ?? -1,
        header: "Antigüedad",
        cell: ({ row }) => {
          const mins = agingMinutes(row.original.occupiedAt);
          if (mins == null) return <span className="text-gray-400">—</span>;
          return <span className="font-medium tabular-nums" style={{ color: agingColor(mins) }}>{fmtAging(mins)}</span>;
        },
        meta: { align: "right" },
      },
    ],
    [],
  );

  const exportColumns = useMemo<ExportColumn<LoadingDock>[]>(
    () => [
      { key: "code", header: "Código" },
      { key: "name", header: "Nombre" },
      { key: "type", header: "Tipo", value: (k) => DOCK_TYPE_META[k.type].label },
      { key: "status", header: "Estado", value: (k) => DOCK_BOARD_META[deriveBoardState(k)].label },
      { key: "buildingName", header: "Edificio" },
      { key: "occupiedAt", header: "Ocupado desde", value: (k) => fmtDateTime(k.occupiedAt) },
      { key: "notes", header: "Notas" },
    ],
    [],
  );

  return (
    <CatalogTable<LoadingDock>
      rows={items}
      columns={columns}
      exportColumns={exportColumns}
      filename="trafico-andenes"
      newLabel="Nuevo andén"
      searchPlaceholder="Buscar andén…"
      kind="docks"
      labelOf={(k) => k.code}
      detailIcon={Warehouse}
      detailSubtitle={(k) => k.name ?? undefined}
      refresh={refresh}
      empty={{
        icon: Building2,
        title: "Registra tu primer andén",
        description: "Los andenes (puertas) son donde cargas los embarques. Su tipo y estado operativo alimentan el Tablero de andenes y la asignación de transporte.",
        hint: [
          "Marca cada puerta como embarque, recibo o mixta.",
          "Sólo los andenes de embarque libres pueden asignarse.",
          "El Tablero te muestra cuáles están libres, ocupados o en carga.",
        ],
      }}
      renderForm={({ initial, onClose, onSaved }) => (
        <DockFormModal initial={initial} onClose={onClose} onSaved={onSaved} />
      )}
      renderDetail={(k) => {
        const mins = agingMinutes(k.occupiedAt);
        const board = DOCK_BOARD_META[deriveBoardState(k)];
        return (
          <DrawerSection title="Detalle">
            <DrawerField label="Código">{k.code}</DrawerField>
            <DrawerField label="Nombre">{k.name || "—"}</DrawerField>
            <DrawerField label="Tipo">
              <Pill label={DOCK_TYPE_META[k.type].label} color={DOCK_TYPE_META[k.type].color} />
            </DrawerField>
            <DrawerField label="Estado">
              <Pill label={board.label} color={board.color} dot />
            </DrawerField>
            <DrawerField label="Edificio">{k.buildingName || "—"}</DrawerField>
            <DrawerField label="Ocupado desde">{fmtDateTime(k.occupiedAt)}</DrawerField>
            <DrawerField label="Antigüedad">
              {mins == null ? "—" : <span style={{ color: agingColor(mins) }}>{fmtAging(mins)}</span>}
            </DrawerField>
            {k.notes && <DrawerField label="Notas">{k.notes}</DrawerField>}
          </DrawerSection>
        );
      }}
    />
  );
}

// ── Assignment ───────────────────────────────────────────────────────────────
function ProgressDots({ status }: { status: string }) {
  if (status === "CANCELLED") {
    return <Pill label={shipmentStatusMeta(status).label} color={COLORS.red} />;
  }
  const idx = SHIPMENT_PROGRESS.indexOf(status);
  return (
    <div className="flex items-center gap-1" title={shipmentStatusMeta(status).label}>
      {SHIPMENT_PROGRESS.map((s, i) => {
        const done = idx >= 0 && i <= idx;
        const color = shipmentStatusMeta(s).color;
        return <span key={s} className="h-1.5 w-5 rounded-full" style={{ background: done ? color : "rgba(120,120,120,0.2)" }} />;
      })}
      <span className="ml-1.5 text-[12px] font-medium" style={{ color: shipmentStatusMeta(status).color }}>
        {shipmentStatusMeta(status).label}
      </span>
    </div>
  );
}

export function AssignmentTab({
  shipments,
  carriers,
  vehicles,
  drivers,
  docks,
  refresh,
}: {
  shipments: OutboundShipmentLite[];
  carriers: Carrier[];
  vehicles: Vehicle[];
  drivers: Driver[];
  docks: LoadingDock[];
  refresh: () => void;
}) {
  const [q, setQ] = useState("");
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [assign, setAssign] = useState<OutboundShipmentLite | null>(null);

  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return shipments.filter((s) => {
      if (onlyUnassigned && s.transportAssignedAt) return false;
      if (n && !`${s.folio ?? ""} ${s.title} ${s.customerName ?? ""}`.toLowerCase().includes(n)) return false;
      return true;
    });
  }, [shipments, q, onlyUnassigned]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar embarque (folio, cliente)…" className="trf-input pl-9" />
        </div>
        <StatusChip label="Sin transporte" active={onlyUnassigned} color={ACCENT} onClick={() => setOnlyUnassigned((v) => !v)} />
      </div>

      {shipments.length === 0 ? (
        <EmptyState
          icon={PackageCheck}
          accent={ACCENT}
          title="Asigna tu primer embarque a un andén"
          description="Cuando existan embarques de salida (outbound), aquí podrás asignarles transportista, unidad, chofer y andén — con el poka-yoke del backend cuidando cada pieza."
          hint={[
            "Toma un embarque pendiente y dale unidad + chofer + andén.",
            "El andén asignado queda ocupado en el Tablero de andenes.",
            "Sigue su avance de carga sin salir de tráfico.",
          ]}
        />
      ) : rows.length === 0 ? (
        <div className={`${glass} rounded-2xl p-10 text-center`}>
          <Inbox className="mx-auto mb-2 h-7 w-7 text-gray-400" />
          <p className="text-sm text-gray-400">Ningún embarque coincide.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {rows.map((s) => (
            <div key={s.id} className={`${glass} flex items-start gap-3 rounded-2xl p-4`}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {s.folio && <MonoCode>{s.folio}</MonoCode>}
                  <span className="truncate font-semibold">{s.customerName || s.title}</span>
                  {s.transportAssignedAt ? (
                    <Pill label="Con transporte" color={COLORS.green} dot />
                  ) : (
                    <Pill label="Sin transporte" color={COLORS.amber} dot />
                  )}
                </div>
                <div className="mt-1.5"><ProgressDots status={s.status} /></div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px] text-gray-400">
                  {s.vehiclePlate ? (
                    <>
                      <span className="inline-flex items-center gap-1"><Truck className="h-3 w-3" />{s.vehiclePlate}</span>
                      {s.driverName && <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />{s.driverName}</span>}
                      {s.dockCode && <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" />{s.dockCode}</span>}
                      {s.carrier && <span>{s.carrier}</span>}
                      {s.transportAssignedAt && <span>· {fmtDateTime(s.transportAssignedAt)}</span>}
                    </>
                  ) : (
                    <span className="italic">Sin unidad/chofer/andén asignados</span>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0">
                <ActionButton onClick={() => setAssign(s)} icon={<PackageCheck className="h-3.5 w-3.5" />} label={s.transportAssignedAt ? "Reasignar" : "Asignar"} color={ACCENT} />
              </div>
            </div>
          ))}
        </div>
      )}

      {assign && (
        <AssignTransportModal
          shipment={assign}
          carriers={carriers}
          vehicles={vehicles}
          drivers={drivers}
          docks={docks}
          onClose={() => setAssign(null)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}
