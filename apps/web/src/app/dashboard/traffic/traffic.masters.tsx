"use client";

// The five tab views of the traffic lane: the four master catalogs (carriers,
// vehicles, drivers, docks) and the assignment view (tie transport to an outbound
// shipment). Each owns its create/edit modal; data + refresh come from the shell.
import React, { useMemo, useState } from "react";
import {
  Building2,
  Inbox,
  Pencil,
  Plus,
  PackageCheck,
  Search,
  Truck,
  User,
} from "lucide-react";
import { glass } from "@/lib/glass";
import { ActionButton, Empty, Pill, StatusChip } from "./traffic.ui";
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
  DOCK_STATUS_META,
  DOCK_TYPE_META,
  DRIVER_STATUS_META,
  VEHICLE_STATUS_META,
  VEHICLE_TYPE_META,
  fmtDateTime,
} from "./traffic.utils";
import type {
  Carrier,
  Driver,
  LoadingDock,
  OutboundShipmentLite,
  Vehicle,
} from "./traffic.types";

// ── shared atoms ─────────────────────────────────────────────────────────────
function Toolbar({
  q,
  setQ,
  placeholder,
  onNew,
  newLabel,
}: {
  q: string;
  setQ: (v: string) => void;
  placeholder: string;
  onNew: () => void;
  newLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="trf-input pl-9" />
      </div>
      <button onClick={onNew} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white" style={{ background: ACCENT }}>
        <Plus className="w-4 h-4" /> {newLabel}
      </button>
    </div>
  );
}

function Row({
  title,
  badges,
  meta,
  onEdit,
  del,
}: {
  title: React.ReactNode;
  badges?: React.ReactNode;
  meta?: React.ReactNode;
  onEdit: () => void;
  del: React.ReactNode;
}) {
  return (
    <div className={`${glass} rounded-2xl p-4 flex items-start gap-3`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold truncate">{title}</span>
          {badges}
        </div>
        {meta && <div className="mt-1 flex items-center gap-2 text-[12px] text-gray-400 flex-wrap">{meta}</div>}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={onEdit} title="Editar" className="p-1.5 rounded-lg text-gray-400 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10">
          <Pencil className="w-4 h-4" />
        </button>
        {del}
      </div>
    </div>
  );
}

function ListState({
  empty,
  filtered,
  onNew,
  icon,
  title,
  body,
  newLabel,
}: {
  empty: boolean;
  filtered: boolean;
  onNew: () => void;
  icon: React.ReactNode;
  title: string;
  body: string;
  newLabel: string;
}) {
  if (empty)
    return (
      <div className={`${glass} rounded-2xl`}>
        <Empty
          icon={icon}
          title={title}
          body={body}
          cta={
            <button onClick={onNew} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: ACCENT }}>
              <Plus className="w-4 h-4" /> {newLabel}
            </button>
          }
        />
      </div>
    );
  if (filtered)
    return (
      <div className={`${glass} rounded-2xl p-10 text-center`}>
        <Inbox className="w-7 h-7 mx-auto mb-2 text-gray-400" />
        <p className="text-sm text-gray-400">Nada coincide con la búsqueda.</p>
      </div>
    );
  return null;
}

// ── Carriers ─────────────────────────────────────────────────────────────────
export function CarriersTab({ items, refresh }: { items: Carrier[]; refresh: () => void }) {
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<null | { edit?: Carrier }>(null);
  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return items.filter((c) => !n || `${c.code} ${c.name} ${c.scac ?? ""}`.toLowerCase().includes(n));
  }, [items, q]);

  return (
    <div>
      <Toolbar q={q} setQ={setQ} placeholder="Buscar transportista…" onNew={() => setModal({})} newLabel="Nuevo transportista" />
      {rows.length === 0 ? (
        <ListState empty={items.length === 0} filtered={items.length > 0} onNew={() => setModal({})} icon={<Truck className="w-7 h-7" />} title="Sin transportistas" body="Da de alta los transportistas (carriers) que mueven tus embarques." newLabel="Nuevo transportista" />
      ) : (
        <div className="space-y-2.5">
          {rows.map((c) => (
            <Row
              key={c.id}
              title={c.name}
              badges={
                <>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500">{c.code}</span>
                  <Pill label={CARRIER_STATUS_META[c.status].label} color={CARRIER_STATUS_META[c.status].color} dot />
                </>
              }
              meta={
                <>
                  <Pill label={CARRIER_MODE_META[c.mode].label} color={CARRIER_MODE_META[c.mode].color} />
                  {c.scac && <span>SCAC {c.scac}</span>}
                  {c.contactName && <span>{c.contactName}</span>}
                  {c.contactPhone && <span>{c.contactPhone}</span>}
                </>
              }
              onEdit={() => setModal({ edit: c })}
              del={<DeleteButton kind="carriers" id={c.id} label={c.name} onDeleted={refresh} />}
            />
          ))}
        </div>
      )}
      {modal && <CarrierFormModal initial={modal.edit} onClose={() => setModal(null)} onSaved={refresh} />}
    </div>
  );
}

// ── Vehicles ─────────────────────────────────────────────────────────────────
export function VehiclesTab({ items, carriers, refresh }: { items: Vehicle[]; carriers: Carrier[]; refresh: () => void }) {
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<null | { edit?: Vehicle }>(null);
  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return items.filter((v) => !n || `${v.plate} ${v.economicNumber ?? ""} ${v.carrierName ?? ""}`.toLowerCase().includes(n));
  }, [items, q]);

  return (
    <div>
      <Toolbar q={q} setQ={setQ} placeholder="Buscar unidad (placa, económico)…" onNew={() => setModal({})} newLabel="Nueva unidad" />
      {rows.length === 0 ? (
        <ListState empty={items.length === 0} filtered={items.length > 0} onNew={() => setModal({})} icon={<Truck className="w-7 h-7" />} title="Sin unidades" body="Registra las unidades (vehículos) con su tipo, capacidad y económico." newLabel="Nueva unidad" />
      ) : (
        <div className="space-y-2.5">
          {rows.map((v) => (
            <Row
              key={v.id}
              title={v.plate}
              badges={
                <>
                  <Pill label={VEHICLE_TYPE_META[v.type].label} color={VEHICLE_TYPE_META[v.type].color} />
                  <Pill label={VEHICLE_STATUS_META[v.status].label} color={VEHICLE_STATUS_META[v.status].color} dot />
                </>
              }
              meta={
                <>
                  {v.economicNumber && <span>Econ. {v.economicNumber}</span>}
                  {v.carrierName && <span>{v.carrierName}</span>}
                  {v.maxWeightKg != null && <span>{v.maxWeightKg} kg</span>}
                  {v.vin && <span className="font-mono">{v.vin}</span>}
                </>
              }
              onEdit={() => setModal({ edit: v })}
              del={<DeleteButton kind="vehicles" id={v.id} label={v.plate} onDeleted={refresh} />}
            />
          ))}
        </div>
      )}
      {modal && <VehicleFormModal initial={modal.edit} carriers={carriers} onClose={() => setModal(null)} onSaved={refresh} />}
    </div>
  );
}

// ── Drivers ──────────────────────────────────────────────────────────────────
export function DriversTab({ items, carriers, refresh }: { items: Driver[]; carriers: Carrier[]; refresh: () => void }) {
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<null | { edit?: Driver }>(null);
  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return items.filter((d) => !n || `${d.name} ${d.licenseNumber ?? ""} ${d.carrierName ?? ""}`.toLowerCase().includes(n));
  }, [items, q]);

  return (
    <div>
      <Toolbar q={q} setQ={setQ} placeholder="Buscar chofer…" onNew={() => setModal({})} newLabel="Nuevo chofer" />
      {rows.length === 0 ? (
        <ListState empty={items.length === 0} filtered={items.length > 0} onNew={() => setModal({})} icon={<User className="w-7 h-7" />} title="Sin choferes" body="Da de alta los choferes con su licencia e identificación para el gate." newLabel="Nuevo chofer" />
      ) : (
        <div className="space-y-2.5">
          {rows.map((d) => (
            <Row
              key={d.id}
              title={d.name}
              badges={<Pill label={DRIVER_STATUS_META[d.status].label} color={DRIVER_STATUS_META[d.status].color} dot />}
              meta={
                <>
                  {d.licenseNumber && <span>Lic. {d.licenseNumber}{d.licenseType ? ` (${d.licenseType})` : ""}</span>}
                  {d.phone && <span>{d.phone}</span>}
                  {d.carrierName && <span>{d.carrierName}</span>}
                </>
              }
              onEdit={() => setModal({ edit: d })}
              del={<DeleteButton kind="drivers" id={d.id} label={d.name} onDeleted={refresh} />}
            />
          ))}
        </div>
      )}
      {modal && <DriverFormModal initial={modal.edit} carriers={carriers} onClose={() => setModal(null)} onSaved={refresh} />}
    </div>
  );
}

// ── Docks ────────────────────────────────────────────────────────────────────
export function DocksTab({ items, refresh }: { items: LoadingDock[]; refresh: () => void }) {
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<null | { edit?: LoadingDock }>(null);
  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return items.filter((k) => !n || `${k.code} ${k.name ?? ""} ${k.buildingName ?? ""}`.toLowerCase().includes(n));
  }, [items, q]);

  return (
    <div>
      <Toolbar q={q} setQ={setQ} placeholder="Buscar andén…" onNew={() => setModal({})} newLabel="Nuevo andén" />
      {rows.length === 0 ? (
        <ListState empty={items.length === 0} filtered={items.length > 0} onNew={() => setModal({})} icon={<Building2 className="w-7 h-7" />} title="Sin andenes" body="Registra los andenes/puertas de embarque para asignarlos a las unidades." newLabel="Nuevo andén" />
      ) : (
        <div className="space-y-2.5">
          {rows.map((k) => (
            <Row
              key={k.id}
              title={k.code}
              badges={
                <>
                  <Pill label={DOCK_TYPE_META[k.type].label} color={DOCK_TYPE_META[k.type].color} />
                  <Pill label={DOCK_STATUS_META[k.status].label} color={DOCK_STATUS_META[k.status].color} dot />
                </>
              }
              meta={
                <>
                  {k.name && <span>{k.name}</span>}
                  {k.buildingName && <span>{k.buildingName}</span>}
                </>
              }
              onEdit={() => setModal({ edit: k })}
              del={<DeleteButton kind="docks" id={k.id} label={k.code} onDeleted={refresh} />}
            />
          ))}
        </div>
      )}
      {modal && <DockFormModal initial={modal.edit} onClose={() => setModal(null)} onSaved={refresh} />}
    </div>
  );
}

// ── Assignment ───────────────────────────────────────────────────────────────
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
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar embarque (folio, cliente)…" className="trf-input pl-9" />
        </div>
        <StatusChip label="Sin transporte" active={onlyUnassigned} color={ACCENT} onClick={() => setOnlyUnassigned((v) => !v)} />
      </div>

      {shipments.length === 0 ? (
        <div className={`${glass} rounded-2xl`}>
          <Empty icon={<PackageCheck className="w-7 h-7" />} title="Sin embarques" body="Cuando existan embarques (outbound), aquí podrás asignarles unidad, chofer y andén." />
        </div>
      ) : rows.length === 0 ? (
        <div className={`${glass} rounded-2xl p-10 text-center`}>
          <Inbox className="w-7 h-7 mx-auto mb-2 text-gray-400" />
          <p className="text-sm text-gray-400">Ningún embarque coincide.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {rows.map((s) => (
            <div key={s.id} className={`${glass} rounded-2xl p-4 flex items-start gap-3`}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {s.folio && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500">{s.folio}</span>}
                  <span className="font-semibold truncate">{s.customerName || s.title}</span>
                  <Pill label={s.status} color={COLORS.gray} />
                  {s.transportAssignedAt ? (
                    <Pill label="Con transporte" color={COLORS.green} dot />
                  ) : (
                    <Pill label="Sin transporte" color={COLORS.amber} dot />
                  )}
                </div>
                <div className="mt-1 flex items-center gap-2 text-[12px] text-gray-400 flex-wrap">
                  {s.vehiclePlate ? (
                    <>
                      <span className="inline-flex items-center gap-1"><Truck className="w-3 h-3" />{s.vehiclePlate}</span>
                      {s.driverName && <span className="inline-flex items-center gap-1"><User className="w-3 h-3" />{s.driverName}</span>}
                      {s.dockCode && <span className="inline-flex items-center gap-1"><Building2 className="w-3 h-3" />{s.dockCode}</span>}
                      {s.carrier && <span>{s.carrier}</span>}
                      {s.transportAssignedAt && <span>· {fmtDateTime(s.transportAssignedAt)}</span>}
                    </>
                  ) : (
                    <span className="italic">Sin unidad/chofer/andén asignados</span>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0">
                <ActionButton onClick={() => setAssign(s)} icon={<PackageCheck className="w-3.5 h-3.5" />} label={s.transportAssignedAt ? "Reasignar" : "Asignar"} color={ACCENT} />
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
