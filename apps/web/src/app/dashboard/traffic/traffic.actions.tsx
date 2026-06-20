"use client";

// Interactive traffic widgets — every call to the backend `traffic` module + the
// outbound transport-assignment endpoints lives here:
//   POST/PATCH/DELETE /traffic/{carriers,vehicles,drivers,docks}
//   POST /outbound/shipments/:id/assign-transport | release-transport
import React, { useState } from "react";
import {
  Building2,
  CheckCircle2,
  Loader2,
  PackageCheck,
  Save,
  Trash2,
  Truck,
  User,
} from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/contexts/ToastContext";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Field, Modal } from "./traffic.ui";
import {
  ACCENT,
  CARRIER_MODES,
  CARRIER_MODE_META,
  CARRIER_STATUS_META,
  COLORS,
  DOCK_STATUS_META,
  DOCK_TYPES,
  DOCK_TYPE_META,
  DRIVER_STATUS_META,
  VEHICLE_STATUS_META,
  VEHICLE_TYPES,
  VEHICLE_TYPE_META,
} from "./traffic.utils";
import type {
  Carrier,
  Driver,
  LoadingDock,
  OutboundShipmentLite,
  Vehicle,
} from "./traffic.types";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000").replace(/\/$/, "");

async function call(path: string, method: string, body?: unknown): Promise<Response> {
  return apiFetch(`${API_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function clean(v: string): string | undefined {
  const t = v.trim();
  return t.length ? t : undefined;
}

// ── Carrier ──────────────────────────────────────────────────────────────────
export function CarrierFormModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: Carrier;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const editing = !!initial;
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    code: initial?.code ?? "",
    name: initial?.name ?? "",
    mode: initial?.mode ?? "GROUND",
    scac: initial?.scac ?? "",
    taxId: initial?.taxId ?? "",
    contactName: initial?.contactName ?? "",
    contactPhone: initial?.contactPhone ?? "",
    contactEmail: initial?.contactEmail ?? "",
    status: initial?.status ?? "active",
    notes: initial?.notes ?? "",
  });

  async function submit() {
    if (!editing && f.code.trim().length < 1) return toast.error("Indica el código.", "Transportista");
    if (f.name.trim().length < 2) return toast.error("Indica el nombre.", "Transportista");
    setBusy(true);
    try {
      const body = {
        ...(!editing && { code: f.code.trim() }),
        name: f.name.trim(),
        mode: f.mode,
        scac: clean(f.scac),
        taxId: clean(f.taxId),
        contactName: clean(f.contactName),
        contactPhone: clean(f.contactPhone),
        contactEmail: clean(f.contactEmail),
        ...(editing && { status: f.status }),
        notes: clean(f.notes),
      };
      const res = editing
        ? await call(`/traffic/carriers/${initial!.id}`, "PATCH", body)
        : await call(`/traffic/carriers`, "POST", body);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        return toast.error(d?.message || "No se pudo guardar.", "Transportista");
      }
      toast.success(editing ? "Transportista actualizado." : "Transportista creado.", "Transportista");
      onSaved();
      onClose();
    } catch {
      toast.error("Error de red.", "Transportista");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={editing ? `Editar ${initial!.code}` : "Nuevo transportista"}
      icon={<Truck className="w-4 h-4" style={{ color: ACCENT }} />}
      accent={ACCENT}
      busy={busy}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={editing ? "Guardar" : "Crear"}
      submitIcon={editing ? <Save className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {!editing && (
          <Field label="Código">
            <input autoFocus value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="DHL" className="trf-input" />
          </Field>
        )}
        <Field label="Nombre" full={editing}>
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="DHL Supply Chain" className="trf-input" />
        </Field>
        <Field label="Modo">
          <select value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value as Carrier["mode"] })} className="trf-input">
            {CARRIER_MODES.map((m) => <option key={m} value={m}>{CARRIER_MODE_META[m].label}</option>)}
          </select>
        </Field>
        <Field label="SCAC">
          <input value={f.scac} onChange={(e) => setF({ ...f, scac: e.target.value })} placeholder="DHLE" className="trf-input" />
        </Field>
        <Field label="RFC / Tax ID">
          <input value={f.taxId} onChange={(e) => setF({ ...f, taxId: e.target.value })} className="trf-input" />
        </Field>
        <Field label="Contacto">
          <input value={f.contactName} onChange={(e) => setF({ ...f, contactName: e.target.value })} className="trf-input" />
        </Field>
        <Field label="Teléfono">
          <input value={f.contactPhone} onChange={(e) => setF({ ...f, contactPhone: e.target.value })} className="trf-input" />
        </Field>
        <Field label="Email">
          <input value={f.contactEmail} onChange={(e) => setF({ ...f, contactEmail: e.target.value })} className="trf-input" />
        </Field>
        {editing && (
          <Field label="Estatus">
            <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Carrier["status"] })} className="trf-input">
              {Object.entries(CARRIER_STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
        )}
        <Field label="Notas" full>
          <textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={2} className="trf-input resize-y" />
        </Field>
      </div>
    </Modal>
  );
}

// ── Vehicle ──────────────────────────────────────────────────────────────────
export function VehicleFormModal({
  initial,
  carriers,
  onClose,
  onSaved,
}: {
  initial?: Vehicle;
  carriers: Carrier[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const editing = !!initial;
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    plate: initial?.plate ?? "",
    type: initial?.type ?? "DRY_VAN",
    economicNumber: initial?.economicNumber ?? "",
    carrierId: initial?.carrierId ?? "",
    maxWeightKg: initial?.maxWeightKg != null ? String(initial.maxWeightKg) : "",
    maxVolumeM3: initial?.maxVolumeM3 != null ? String(initial.maxVolumeM3) : "",
    vin: initial?.vin ?? "",
    status: initial?.status ?? "available",
    notes: initial?.notes ?? "",
  });

  async function submit() {
    if (f.plate.trim().length < 1) return toast.error("Indica la placa.", "Unidad");
    setBusy(true);
    try {
      const body = {
        plate: f.plate.trim(),
        type: f.type,
        economicNumber: clean(f.economicNumber),
        carrierId: f.carrierId || undefined,
        maxWeightKg: f.maxWeightKg ? Number(f.maxWeightKg) : undefined,
        maxVolumeM3: f.maxVolumeM3 ? Number(f.maxVolumeM3) : undefined,
        vin: clean(f.vin),
        ...(editing && { status: f.status }),
        notes: clean(f.notes),
      };
      const res = editing
        ? await call(`/traffic/vehicles/${initial!.id}`, "PATCH", body)
        : await call(`/traffic/vehicles`, "POST", body);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        return toast.error(d?.message || "No se pudo guardar.", "Unidad");
      }
      toast.success(editing ? "Unidad actualizada." : "Unidad creada.", "Unidad");
      onSaved();
      onClose();
    } catch {
      toast.error("Error de red.", "Unidad");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={editing ? `Editar ${initial!.plate}` : "Nueva unidad"}
      icon={<Truck className="w-4 h-4" style={{ color: ACCENT }} />}
      accent={ACCENT}
      busy={busy}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={editing ? "Guardar" : "Crear"}
      submitIcon={editing ? <Save className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Placa">
          <input autoFocus value={f.plate} onChange={(e) => setF({ ...f, plate: e.target.value })} placeholder="ABC-123-Z" className="trf-input" />
        </Field>
        <Field label="Tipo">
          <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as Vehicle["type"] })} className="trf-input">
            {VEHICLE_TYPES.map((t) => <option key={t} value={t}>{VEHICLE_TYPE_META[t].label}</option>)}
          </select>
        </Field>
        <Field label="N° económico">
          <input value={f.economicNumber} onChange={(e) => setF({ ...f, economicNumber: e.target.value })} className="trf-input" />
        </Field>
        <Field label="Transportista">
          <select value={f.carrierId} onChange={(e) => setF({ ...f, carrierId: e.target.value })} className="trf-input">
            <option value="">— ninguno —</option>
            {carriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Capacidad (kg)">
          <input type="number" min={0} value={f.maxWeightKg} onChange={(e) => setF({ ...f, maxWeightKg: e.target.value })} className="trf-input" />
        </Field>
        <Field label="Volumen (m³)">
          <input type="number" min={0} value={f.maxVolumeM3} onChange={(e) => setF({ ...f, maxVolumeM3: e.target.value })} className="trf-input" />
        </Field>
        <Field label="VIN">
          <input value={f.vin} onChange={(e) => setF({ ...f, vin: e.target.value })} className="trf-input" />
        </Field>
        {editing && (
          <Field label="Estatus">
            <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Vehicle["status"] })} className="trf-input">
              {Object.entries(VEHICLE_STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
        )}
        <Field label="Notas" full>
          <textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={2} className="trf-input resize-y" />
        </Field>
      </div>
    </Modal>
  );
}

// ── Driver ───────────────────────────────────────────────────────────────────
export function DriverFormModal({
  initial,
  carriers,
  onClose,
  onSaved,
}: {
  initial?: Driver;
  carriers: Carrier[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const editing = !!initial;
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    name: initial?.name ?? "",
    licenseNumber: initial?.licenseNumber ?? "",
    licenseType: initial?.licenseType ?? "",
    phone: initial?.phone ?? "",
    idDocument: initial?.idDocument ?? "",
    carrierId: initial?.carrierId ?? "",
    status: initial?.status ?? "available",
    notes: initial?.notes ?? "",
  });

  async function submit() {
    if (f.name.trim().length < 2) return toast.error("Indica el nombre.", "Chofer");
    setBusy(true);
    try {
      const body = {
        name: f.name.trim(),
        licenseNumber: clean(f.licenseNumber),
        licenseType: clean(f.licenseType),
        phone: clean(f.phone),
        idDocument: clean(f.idDocument),
        carrierId: f.carrierId || undefined,
        ...(editing && { status: f.status }),
        notes: clean(f.notes),
      };
      const res = editing
        ? await call(`/traffic/drivers/${initial!.id}`, "PATCH", body)
        : await call(`/traffic/drivers`, "POST", body);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        return toast.error(d?.message || "No se pudo guardar.", "Chofer");
      }
      toast.success(editing ? "Chofer actualizado." : "Chofer creado.", "Chofer");
      onSaved();
      onClose();
    } catch {
      toast.error("Error de red.", "Chofer");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={editing ? `Editar ${initial!.name}` : "Nuevo chofer"}
      icon={<User className="w-4 h-4" style={{ color: ACCENT }} />}
      accent={ACCENT}
      busy={busy}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={editing ? "Guardar" : "Crear"}
      submitIcon={editing ? <Save className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Nombre" full>
          <input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Juan Pérez" className="trf-input" />
        </Field>
        <Field label="N° licencia">
          <input value={f.licenseNumber} onChange={(e) => setF({ ...f, licenseNumber: e.target.value })} className="trf-input" />
        </Field>
        <Field label="Tipo licencia">
          <input value={f.licenseType} onChange={(e) => setF({ ...f, licenseType: e.target.value })} placeholder="Federal C" className="trf-input" />
        </Field>
        <Field label="Teléfono">
          <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className="trf-input" />
        </Field>
        <Field label="Identificación (INE)">
          <input value={f.idDocument} onChange={(e) => setF({ ...f, idDocument: e.target.value })} className="trf-input" />
        </Field>
        <Field label="Transportista">
          <select value={f.carrierId} onChange={(e) => setF({ ...f, carrierId: e.target.value })} className="trf-input">
            <option value="">— ninguno —</option>
            {carriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        {editing && (
          <Field label="Estatus">
            <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Driver["status"] })} className="trf-input">
              {Object.entries(DRIVER_STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
        )}
        <Field label="Notas" full>
          <textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={2} className="trf-input resize-y" />
        </Field>
      </div>
    </Modal>
  );
}

// ── Dock ─────────────────────────────────────────────────────────────────────
export function DockFormModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: LoadingDock;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const editing = !!initial;
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    code: initial?.code ?? "",
    name: initial?.name ?? "",
    type: initial?.type ?? "shipping",
    buildingName: initial?.buildingName ?? "",
    status: initial?.status ?? "available",
    notes: initial?.notes ?? "",
  });

  async function submit() {
    if (!editing && f.code.trim().length < 1) return toast.error("Indica el código.", "Andén");
    setBusy(true);
    try {
      const body = {
        ...(!editing && { code: f.code.trim() }),
        name: clean(f.name),
        type: f.type,
        buildingName: clean(f.buildingName),
        ...(editing && { status: f.status }),
        notes: clean(f.notes),
      };
      const res = editing
        ? await call(`/traffic/docks/${initial!.id}`, "PATCH", body)
        : await call(`/traffic/docks`, "POST", body);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        return toast.error(d?.message || "No se pudo guardar.", "Andén");
      }
      toast.success(editing ? "Andén actualizado." : "Andén creado.", "Andén");
      onSaved();
      onClose();
    } catch {
      toast.error("Error de red.", "Andén");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={editing ? `Editar ${initial!.code}` : "Nuevo andén"}
      icon={<Building2 className="w-4 h-4" style={{ color: ACCENT }} />}
      accent={ACCENT}
      busy={busy}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={editing ? "Guardar" : "Crear"}
      submitIcon={editing ? <Save className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {!editing && (
          <Field label="Código">
            <input autoFocus value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="D-04" className="trf-input" />
          </Field>
        )}
        <Field label="Nombre" full={editing}>
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Andén 4 — Embarques" className="trf-input" />
        </Field>
        <Field label="Tipo">
          <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as LoadingDock["type"] })} className="trf-input">
            {DOCK_TYPES.map((t) => <option key={t} value={t}>{DOCK_TYPE_META[t].label}</option>)}
          </select>
        </Field>
        <Field label="Edificio">
          <input value={f.buildingName} onChange={(e) => setF({ ...f, buildingName: e.target.value })} className="trf-input" />
        </Field>
        {editing && (
          <Field label="Estatus">
            <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as LoadingDock["status"] })} className="trf-input">
              {Object.entries(DOCK_STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
        )}
        <Field label="Notas" full>
          <textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={2} className="trf-input resize-y" />
        </Field>
      </div>
    </Modal>
  );
}

// ── Delete (soft) ────────────────────────────────────────────────────────────
export function DeleteButton({
  kind,
  id,
  label,
  onDeleted,
}: {
  kind: "carriers" | "vehicles" | "drivers" | "docks";
  id: string;
  label: string;
  onDeleted: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  async function run() {
    if (!(await confirm({ message: `¿Eliminar ${label}?`, tone: 'danger', confirmLabel: 'Eliminar' }))) return;
    setBusy(true);
    try {
      const res = await call(`/traffic/${kind}/${id}`, "DELETE");
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        return toast.error(d?.message || "No se pudo eliminar.", "Tráfico");
      }
      toast.success("Eliminado.", "Tráfico");
      onDeleted();
    } catch {
      toast.error("Error de red.", "Tráfico");
    } finally {
      setBusy(false);
    }
  }
  return (
    <button onClick={run} disabled={busy} title="Eliminar" className="p-1.5 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-500/10 disabled:opacity-50">
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
    </button>
  );
}

// ── Assign transport to a shipment ───────────────────────────────────────────
export function AssignTransportModal({
  shipment,
  carriers,
  vehicles,
  drivers,
  docks,
  onClose,
  onChanged,
}: {
  shipment: OutboundShipmentLite;
  carriers: Carrier[];
  vehicles: Vehicle[];
  drivers: Driver[];
  docks: LoadingDock[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [f, setF] = useState({
    carrierId: shipment.carrierId ?? "",
    vehicleId: shipment.vehicleId ?? "",
    driverId: shipment.driverId ?? "",
    dockId: shipment.dockId ?? "",
  });

  // Sólo lo asignable (o lo ya ligado a ESTE embarque) — el backend revalida.
  const okCarriers = carriers.filter((c) => c.status === "active" || c.id === shipment.carrierId);
  const okVehicles = vehicles.filter((v) => v.status === "available" || v.id === shipment.vehicleId);
  const okDrivers = drivers.filter((d) => d.status === "available" || d.id === shipment.driverId);
  const okDocks = docks.filter(
    (k) => (k.status === "available" && k.type !== "receiving") || k.id === shipment.dockId,
  );

  async function submit() {
    const body = {
      carrierId: f.carrierId || undefined,
      vehicleId: f.vehicleId || undefined,
      driverId: f.driverId || undefined,
      dockId: f.dockId || undefined,
    };
    if (!body.carrierId && !body.vehicleId && !body.driverId && !body.dockId) {
      return toast.error("Elige al menos una unidad/chofer/andén.", "Tráfico");
    }
    setBusy(true);
    try {
      const res = await call(`/outbound/shipments/${shipment.id}/assign-transport`, "POST", body);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        return toast.error(d?.message || "No se pudo asignar.", "Tráfico");
      }
      toast.success("Transporte asignado.", "Tráfico");
      onChanged();
      onClose();
    } catch {
      toast.error("Error de red.", "Tráfico");
    } finally {
      setBusy(false);
    }
  }

  async function release() {
    setReleasing(true);
    try {
      const res = await call(`/outbound/shipments/${shipment.id}/release-transport`, "POST");
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        return toast.error(d?.message || "No se pudo liberar.", "Tráfico");
      }
      toast.success("Transporte liberado.", "Tráfico");
      onChanged();
      onClose();
    } catch {
      toast.error("Error de red.", "Tráfico");
    } finally {
      setReleasing(false);
    }
  }

  return (
    <Modal
      title={`Asignar transporte · ${shipment.folio ?? shipment.title}`}
      icon={<PackageCheck className="w-4 h-4" style={{ color: ACCENT }} />}
      accent={ACCENT}
      busy={busy}
      onClose={onClose}
      onSubmit={submit}
      submitLabel="Asignar"
      submitIcon={<CheckCircle2 className="w-4 h-4" />}
    >
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        El backend valida cada pieza (poka-yoke): no deja asignar unidad/chofer/andén inactivos, en mantenimiento, de recibo o ya ocupados por otro embarque.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Transportista">
          <select value={f.carrierId} onChange={(e) => setF({ ...f, carrierId: e.target.value })} className="trf-input">
            <option value="">— sin asignar —</option>
            {okCarriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Unidad">
          <select value={f.vehicleId} onChange={(e) => setF({ ...f, vehicleId: e.target.value })} className="trf-input">
            <option value="">— sin asignar —</option>
            {okVehicles.map((v) => <option key={v.id} value={v.id}>{v.plate} · {VEHICLE_TYPE_META[v.type].label}</option>)}
          </select>
        </Field>
        <Field label="Chofer">
          <select value={f.driverId} onChange={(e) => setF({ ...f, driverId: e.target.value })} className="trf-input">
            <option value="">— sin asignar —</option>
            {okDrivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
        <Field label="Andén">
          <select value={f.dockId} onChange={(e) => setF({ ...f, dockId: e.target.value })} className="trf-input">
            <option value="">— sin asignar —</option>
            {okDocks.map((k) => <option key={k.id} value={k.id}>{k.code}{k.name ? ` · ${k.name}` : ""}</option>)}
          </select>
        </Field>
      </div>
      {shipment.transportAssignedAt && (
        <button
          onClick={release}
          disabled={releasing}
          className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium disabled:opacity-50"
          style={{ color: COLORS.red }}
        >
          {releasing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          Liberar transporte asignado
        </button>
      )}
    </Modal>
  );
}
