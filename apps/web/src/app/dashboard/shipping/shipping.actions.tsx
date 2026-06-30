"use client";

// Interactive shipping widgets — every piece that hits the backend lives here so
// the list, the row and the detail drawer never duplicate a mutation. Each one
// targets a real endpoint of the `shipping` module and reports via toast:
//   POST  /shipping                     create
//   POST  /shipping/:id/items           stage material (eligibility-gated)
//   POST  /shipping/:id/packing-list    generate packing list
//   PATCH /shipping/:id/start-loading    open manifest → LOADING
//   PATCH /shipping/:id/dispatch          → DISPATCHED (backend requires LOADING)
//   PATCH /shipping/:id/close             → CLOSED
//   POST  /shipping/:id/discrepancy      log an operational exception
import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  FileText,
  Loader2,
  PackagePlus,
  Send,
  Tag,
  Truck,
  Lock,
} from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { Field, Modal } from "./shipping.ui";
import { ACCENT, COLORS } from "./shipping.utils";
import type {
  AddItemInput,
  CreateShipmentInput,
  InventoryPosition,
  Shipment,
  StartLoadingInput,
} from "./shipping.types";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000").replace(/\/$/, "");
const FG_WAREHOUSE = "WH-FG"; // backend stages only released FG stock from here

// Tipos de discrepancia de empaque (alimentan la excepción operacional del backend).
const DISCREPANCY_TYPES: { value: string; label: string }[] = [
  { value: "SHORTAGE", label: "Faltante" },
  { value: "OVERAGE", label: "Sobrante" },
  { value: "DAMAGE", label: "Daño" },
  { value: "MISLABEL", label: "Etiqueta incorrecta" },
  { value: "WRONG_ITEM", label: "Ítem equivocado" },
  { value: "OTHER", label: "Otro" },
];

async function call(path: string, method: string, body?: unknown): Promise<Response> {
  return apiFetch(`${API_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function useActor(): string {
  const { user } = useAuth();
  return user?.email || "Shipping Agent";
}

// Etiqueta GS1 (ZPL) + ASN (EDI 856): descargan el documento REAL que genera el
// backend (shipping). apiFetch añade el JWT, así que se baja como blob y se
// dispara la descarga (un <a href> directo daría 401). El SSCC sale con prefijo
// placeholder hasta configurar GS1_COMPANY_PREFIX, pero el documento es real.
export function LabelAsnActions({ shipmentId }: { shipmentId: number }) {
  const toast = useToast();
  const [busy, setBusy] = useState<null | "label" | "asn">(null);

  async function grab(path: string, filename: string, which: "label" | "asn", okMsg: string) {
    setBusy(which);
    try {
      const res = await call(path, "GET");
      if (!res.ok) throw new Error(String(res.status));
      const text = await res.text();
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(okMsg, "Embarques");
    } catch {
      toast.error("No se pudo generar el documento. Revisa tus permisos.", "Embarques");
    } finally {
      setBusy(null);
    }
  }

  const btn =
    "inline-flex items-center justify-center gap-1.5 w-full px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition disabled:opacity-50 bg-black/5 dark:bg-white/10 text-gray-700 dark:text-gray-200 hover:bg-black/10 dark:hover:bg-white/15";

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={() => grab(`/shipping/${shipmentId}/label.zpl`, `etiqueta-SHP-${shipmentId}.zpl`, "label", "Etiqueta GS1 (ZPL) generada")}
        disabled={busy !== null}
        className={btn}
      >
        {busy === "label" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Tag className="w-3.5 h-3.5" />}
        Imprimir etiqueta (GS1 / ZPL)
      </button>
      <button
        onClick={() => grab(`/shipping/${shipmentId}/asn.edi`, `asn-SHP-${shipmentId}.edi`, "asn", "ASN (EDI 856) generado")}
        disabled={busy !== null}
        className={btn}
      >
        {busy === "asn" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
        Generar ASN (EDI 856)
      </button>
    </div>
  );
}

// ── Botón de acción compacto (tinte semántico) ───────────────────────────────
export function ActionButton({
  onClick,
  icon,
  label,
  color,
  busy,
  disabled,
  title,
  full,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  color: string;
  busy?: boolean;
  disabled?: boolean;
  title?: string;
  full?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy || disabled}
      title={title}
      className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium disabled:opacity-50 ${full ? "w-full" : ""}`}
      style={{ background: `${color}1f`, color }}
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}
      {label}
    </button>
  );
}

// ── Crear embarque (POST /shipping) ──────────────────────────────────────────
export function CreateShipmentModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (created?: Shipment) => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    customer: "",
    carrier: "",
    route: "",
    dockNumber: "",
    scheduledAt: "",
  });

  async function submit() {
    if (form.customer.trim().length < 2) {
      toast.error("Indica el cliente del embarque.", "Embarque");
      return;
    }
    setBusy(true);
    try {
      const body: CreateShipmentInput = {
        customer: form.customer.trim(),
        carrier: form.carrier.trim() || undefined,
        route: form.route.trim() || undefined,
        dockNumber: form.dockNumber.trim() || undefined,
        scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
      };
      const res = await call("/shipping", "POST", body);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || "No se pudo crear el embarque.", "Embarque");
        return;
      }
      const created = (await res.json().catch(() => undefined)) as Shipment | undefined;
      toast.success("Embarque creado.", "Embarque");
      onCreated(created);
      onClose();
    } catch {
      toast.error("Error de red.", "Embarque");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Nuevo embarque"
      icon={<Truck className="w-4 h-4" style={{ color: ACCENT }} />}
      accent={ACCENT}
      busy={busy}
      onClose={onClose}
      onSubmit={submit}
      submitLabel="Crear embarque"
      submitIcon={<CheckCircle2 className="w-4 h-4" />}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Cliente" full hint="Destinatario del embarque (obligatorio).">
          <input
            autoFocus
            value={form.customer}
            onChange={(e) => setForm({ ...form, customer: e.target.value })}
            placeholder="Cliente A"
            className="shp-input"
          />
        </Field>
        <Field label="Transportista">
          <input value={form.carrier} onChange={(e) => setForm({ ...form, carrier: e.target.value })} placeholder="DHL / Estafeta…" className="shp-input" />
        </Field>
        <Field label="Ruta / destino">
          <input value={form.route} onChange={(e) => setForm({ ...form, route: e.target.value })} placeholder="Guadalajara, MX" className="shp-input" />
        </Field>
        <Field label="Andén">
          <input value={form.dockNumber} onChange={(e) => setForm({ ...form, dockNumber: e.target.value })} placeholder="D-04" className="shp-input" />
        </Field>
        <Field label="Cita de embarque">
          <input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} className="shp-input" />
        </Field>
      </div>
      <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-4">
        El embarque nace en <strong>Planeación</strong>. El folio (SHP-…) lo asigna el backend.
      </p>
    </Modal>
  );
}

// ── Surtir material (POST /shipping/:id/items) ───────────────────────────────
// Mejora progresiva: lee inventario de PT disponible (WH-FG, holdStatus
// 'available') para ofrecer un selector de partes elegibles. Si esa lectura falla,
// el campo sigue siendo texto libre y el backend valida la elegibilidad.
export function AddItemButton({
  shipment,
  onChanged,
  label = "Agregar material",
  color = COLORS.amber,
  full,
}: {
  shipment: Pick<Shipment, "id" | "shipmentNumber">;
  onChanged: () => void;
  label?: string;
  color?: string;
  full?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ActionButton onClick={() => setOpen(true)} icon={<PackagePlus className="w-3.5 h-3.5" />} label={label} color={color} full={full} />
      {open && <AddItemModal shipment={shipment} onClose={() => setOpen(false)} onChanged={onChanged} />}
    </>
  );
}

function AddItemModal({
  shipment,
  onClose,
  onChanged,
}: {
  shipment: Pick<Shipment, "id" | "shipmentNumber">;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ partNumber: "", quantity: "", lotNumber: "", workOrder: "", fromLocation: "" });

  // Inventario elegible (PT liberado en WH-FG). Sin permiso/sin datos → mapa vacío.
  const { data: positions } = useApi<InventoryPosition[]>(`/inventory/positions?warehouseId=${FG_WAREHOUSE}`);
  const eligible = useMemo(() => {
    const map = new Map<string, { available: number; locations: Set<string>; lots: Set<string> }>();
    for (const p of positions ?? []) {
      if (p.holdStatus !== "available") continue;
      const avail = (p.onHand ?? 0) - (p.allocated ?? 0);
      if (avail <= 0) continue;
      const e = map.get(p.partNumber) ?? { available: 0, locations: new Set<string>(), lots: new Set<string>() };
      e.available += avail;
      if (p.location) e.locations.add(p.location);
      if (p.lotNumber) e.lots.add(p.lotNumber);
      map.set(p.partNumber, e);
    }
    return map;
  }, [positions]);

  const eligibleList = useMemo(
    () => [...eligible.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    [eligible],
  );
  const picked = eligible.get(form.partNumber.trim());
  const qtyNum = Number(form.quantity);
  const overAvailable = !!picked && qtyNum > picked.available;

  async function submit() {
    const partNumber = form.partNumber.trim();
    if (!partNumber) {
      toast.error("Indica el número de parte.", "Surtido");
      return;
    }
    if (!(qtyNum > 0)) {
      toast.error("La cantidad debe ser mayor a 0.", "Surtido");
      return;
    }
    setBusy(true);
    try {
      const body: AddItemInput = {
        partNumber,
        quantity: qtyNum,
        lotNumber: form.lotNumber.trim() || undefined,
        workOrder: form.workOrder.trim() || undefined,
        fromLocation: form.fromLocation.trim() || undefined,
      };
      const res = await call(`/shipping/${shipment.id}/items`, "POST", body);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        // El backend rechaza material no liberado (OQC) con un mensaje claro.
        toast.error(d?.message || "No se pudo surtir el material.", "Surtido");
        return;
      }
      toast.success(`${partNumber} surtido al embarque.`, "Surtido");
      onChanged();
      onClose();
    } catch {
      toast.error("Error de red.", "Surtido");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Surtir material · ${shipment.shipmentNumber}`}
      icon={<PackagePlus className="w-4 h-4" style={{ color: COLORS.amber }} />}
      accent={COLORS.amber}
      busy={busy}
      onClose={onClose}
      onSubmit={submit}
      submitLabel="Surtir al embarque"
      submitIcon={<PackagePlus className="w-4 h-4" />}
      submitDisabled={!form.partNumber.trim() || !(qtyNum > 0)}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          label="Número de parte"
          full
          hint={
            eligibleList.length > 0
              ? "Sugerencias = PT liberado disponible en WH-FG. También puedes escribirlo."
              : "Sólo se puede surtir PT liberado (OQC aprobado) de WH-FG; el backend lo valida."
          }
        >
          <input
            autoFocus
            list="shp-eligible-parts"
            value={form.partNumber}
            onChange={(e) => {
              const partNumber = e.target.value;
              const loc = eligible.get(partNumber.trim())?.locations.values().next().value ?? "";
              setForm((f) => ({ ...f, partNumber, fromLocation: f.fromLocation || loc }));
            }}
            placeholder="PN-1024"
            className="shp-input"
          />
          <datalist id="shp-eligible-parts">
            {eligibleList.map(([pn, e]) => (
              <option key={pn} value={pn}>{`${pn} — ${e.available} disp.`}</option>
            ))}
          </datalist>
        </Field>
        <Field label="Cantidad" hint={picked ? `Disponible liberado: ${picked.available}` : undefined}>
          <input
            type="number"
            min={0}
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            placeholder="0"
            className="shp-input"
            style={overAvailable ? { borderColor: COLORS.red } : undefined}
          />
        </Field>
        <Field label="Ubicación origen" hint={picked && picked.locations.size > 0 ? `En: ${[...picked.locations].join(", ")}` : undefined}>
          <input value={form.fromLocation} onChange={(e) => setForm({ ...form, fromLocation: e.target.value })} placeholder="STAGING" className="shp-input" />
        </Field>
        <Field label="Lote (opcional)">
          <input value={form.lotNumber} onChange={(e) => setForm({ ...form, lotNumber: e.target.value })} placeholder="LOT-…" className="shp-input" />
        </Field>
        <Field label="Orden de trabajo (opcional)">
          <input value={form.workOrder} onChange={(e) => setForm({ ...form, workOrder: e.target.value })} placeholder="WO-…" className="shp-input" />
        </Field>
      </div>
      {overAvailable && (
        <p className="text-[12px] mt-3 inline-flex items-center gap-1.5" style={{ color: COLORS.red }}>
          <AlertTriangle className="w-3.5 h-3.5" />
          Pides {qtyNum} pero sólo hay {picked?.available} liberado. El backend lo rechazará y abrirá una excepción.
        </p>
      )}
      <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-3">
        Surtir mueve el embarque a <strong>Surtido</strong> y deja el material en el andén de embarque.
      </p>
    </Modal>
  );
}

// ── Generar lista de empaque (POST /shipping/:id/packing-list) ───────────────
export function GeneratePackingListButton({
  shipment,
  onChanged,
  full,
}: {
  shipment: Pick<Shipment, "id">;
  onChanged: () => void;
  full?: boolean;
}) {
  const toast = useToast();
  const actor = useActor();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const res = await call(`/shipping/${shipment.id}/packing-list`, "POST", { actor });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || "No se pudo generar la lista.", "Lista de empaque");
        return;
      }
      toast.success("Lista de empaque generada.", "Lista de empaque");
      onChanged();
    } catch {
      toast.error("Error de red.", "Lista de empaque");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ActionButton onClick={run} icon={<ClipboardList className="w-3.5 h-3.5" />} label="Generar lista de empaque" color={COLORS.cyan} busy={busy} full={full} />
  );
}

// ── Iniciar carga / manifiesto (PATCH /shipping/:id/start-loading) ───────────
export function StartLoadingButton({
  shipment,
  onChanged,
  label = "Iniciar carga",
  full,
}: {
  shipment: Shipment;
  onChanged: () => void;
  label?: string;
  full?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ActionButton onClick={() => setOpen(true)} icon={<Truck className="w-3.5 h-3.5" />} label={label} color={COLORS.blue} full={full} />
      {open && <StartLoadingModal shipment={shipment} onClose={() => setOpen(false)} onChanged={onChanged} />}
    </>
  );
}

function StartLoadingModal({
  shipment,
  onClose,
  onChanged,
}: {
  shipment: Shipment;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    carrier: shipment.carrier ?? "",
    truckPlate: shipment.truckPlate ?? "",
    driverName: shipment.driverName ?? "",
    dockNumber: shipment.dockNumber ?? "",
    route: shipment.route ?? "",
    trackingNumber: shipment.trackingNumber ?? "",
  });

  async function submit() {
    setBusy(true);
    try {
      const body: StartLoadingInput = {
        carrier: form.carrier.trim() || undefined,
        truckPlate: form.truckPlate.trim() || undefined,
        driverName: form.driverName.trim() || undefined,
        dockNumber: form.dockNumber.trim() || undefined,
        route: form.route.trim() || undefined,
        trackingNumber: form.trackingNumber.trim() || undefined,
      };
      const res = await call(`/shipping/${shipment.id}/start-loading`, "PATCH", body);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || "No se pudo iniciar la carga.", "Carga");
        return;
      }
      toast.success("Carga iniciada — manifiesto abierto.", "Carga");
      onChanged();
      onClose();
    } catch {
      toast.error("Error de red.", "Carga");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Iniciar carga · ${shipment.shipmentNumber}`}
      icon={<Truck className="w-4 h-4" style={{ color: COLORS.blue }} />}
      accent={COLORS.blue}
      busy={busy}
      onClose={onClose}
      onSubmit={submit}
      submitLabel="Iniciar carga"
      submitIcon={<Truck className="w-4 h-4" />}
    >
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Captura el manifiesto del transporte. Esto mueve el embarque a <strong>Cargando</strong> y registra la hora de inicio.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Transportista">
          <input autoFocus value={form.carrier} onChange={(e) => setForm({ ...form, carrier: e.target.value })} placeholder="DHL / Estafeta…" className="shp-input" />
        </Field>
        <Field label="Placa del camión">
          <input value={form.truckPlate} onChange={(e) => setForm({ ...form, truckPlate: e.target.value })} placeholder="ABC-123-Z" className="shp-input" />
        </Field>
        <Field label="Operador / chofer">
          <input value={form.driverName} onChange={(e) => setForm({ ...form, driverName: e.target.value })} placeholder="Nombre del chofer" className="shp-input" />
        </Field>
        <Field label="Andén">
          <input value={form.dockNumber} onChange={(e) => setForm({ ...form, dockNumber: e.target.value })} placeholder="D-04" className="shp-input" />
        </Field>
        <Field label="Ruta / destino">
          <input value={form.route} onChange={(e) => setForm({ ...form, route: e.target.value })} placeholder="Guadalajara, MX" className="shp-input" />
        </Field>
        <Field label="Guía / tracking">
          <input value={form.trackingNumber} onChange={(e) => setForm({ ...form, trackingNumber: e.target.value })} placeholder="N° de guía" className="shp-input" />
        </Field>
      </div>
    </Modal>
  );
}

// ── Despachar (PATCH /shipping/:id/dispatch) ─────────────────────────────────
export function DispatchButton({
  shipment,
  onChanged,
  label = "Despachar",
  full,
}: {
  shipment: Shipment;
  onChanged: () => void;
  label?: string;
  full?: boolean;
}) {
  const toast = useToast();
  const actor = useActor();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const res = await call(`/shipping/${shipment.id}/dispatch`, "PATCH", { actor });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || "No se pudo despachar.", "Despacho");
        return;
      }
      toast.success("Embarque despachado.", "Despacho");
      onChanged();
      setOpen(false);
    } catch {
      toast.error("Error de red.", "Despacho");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ActionButton onClick={() => setOpen(true)} icon={<Send className="w-3.5 h-3.5" />} label={label} color={COLORS.indigo} full={full} />
      {open && (
        <Modal
          title={`Despachar · ${shipment.shipmentNumber}`}
          icon={<Send className="w-4 h-4" style={{ color: COLORS.indigo }} />}
          accent={COLORS.indigo}
          busy={busy}
          onClose={() => setOpen(false)}
          onSubmit={run}
          submitLabel="Confirmar despacho"
          submitIcon={<Send className="w-4 h-4" />}
        >
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Confirma la salida de planta. El backend ejecuta el movimiento de inventario (salida del andén)
            y deja traza de auditoría. Sólo procede si el embarque está en <strong>Cargando</strong>.
          </p>
          <dl className="mt-4 space-y-1.5 text-sm">
            <Row k="Cliente" v={shipment.customer} />
            <Row k="Transportista" v={shipment.carrier || "—"} />
            <Row k="Camión / chofer" v={[shipment.truckPlate, shipment.driverName].filter(Boolean).join(" · ") || "—"} />
            <Row k="Responsable" v={actor} />
          </dl>
        </Modal>
      )}
    </>
  );
}

// ── Cerrar embarque (PATCH /shipping/:id/close) ──────────────────────────────
export function CloseButton({
  shipment,
  onChanged,
  label = "Cerrar embarque",
  full,
}: {
  shipment: Pick<Shipment, "id" | "shipmentNumber">;
  onChanged: () => void;
  label?: string;
  full?: boolean;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const res = await call(`/shipping/${shipment.id}/close`, "PATCH");
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || "No se pudo cerrar.", "Cierre");
        return;
      }
      toast.success("Embarque cerrado.", "Cierre");
      onChanged();
      setOpen(false);
    } catch {
      toast.error("Error de red.", "Cierre");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ActionButton onClick={() => setOpen(true)} icon={<CheckCircle2 className="w-3.5 h-3.5" />} label={label} color={COLORS.green} full={full} />
      {open && (
        <Modal
          title={`Cerrar · ${shipment.shipmentNumber}`}
          icon={<CheckCircle2 className="w-4 h-4" style={{ color: COLORS.green }} />}
          accent={COLORS.green}
          busy={busy}
          onClose={() => setOpen(false)}
          onSubmit={run}
          submitLabel="Cerrar embarque"
          submitIcon={<CheckCircle2 className="w-4 h-4" />}
        >
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Marca el embarque como <strong>Cerrado</strong> (entregado/archivado). Es un estado final: no hay endpoint para reabrir.
          </p>
        </Modal>
      )}
    </>
  );
}

// ── Reportar discrepancia (POST /shipping/:id/discrepancy) ───────────────────
export function ReportDiscrepancyButton({
  shipment,
  onChanged,
  full,
}: {
  shipment: Pick<Shipment, "id" | "shipmentNumber">;
  onChanged: () => void;
  full?: boolean;
}) {
  const toast = useToast();
  const actor = useActor();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ type: DISCREPANCY_TYPES[0].value, detail: "" });

  async function submit() {
    if (form.detail.trim().length < 3) {
      toast.error("Describe la discrepancia.", "Discrepancia");
      return;
    }
    setBusy(true);
    try {
      const res = await call(`/shipping/${shipment.id}/discrepancy`, "POST", {
        type: form.type,
        detail: form.detail.trim(),
        actor,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || "No se pudo registrar.", "Discrepancia");
        return;
      }
      toast.success("Discrepancia registrada (excepción abierta).", "Discrepancia");
      setForm({ type: DISCREPANCY_TYPES[0].value, detail: "" });
      onChanged();
      setOpen(false);
    } catch {
      toast.error("Error de red.", "Discrepancia");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ActionButton onClick={() => setOpen(true)} icon={<AlertTriangle className="w-3.5 h-3.5" />} label="Reportar discrepancia" color={COLORS.red} full={full} />
      {open && (
        <Modal
          title={`Discrepancia · ${shipment.shipmentNumber}`}
          icon={<AlertTriangle className="w-4 h-4" style={{ color: COLORS.red }} />}
          accent={COLORS.red}
          busy={busy}
          onClose={() => setOpen(false)}
          onSubmit={submit}
          submitLabel="Registrar discrepancia"
          submitIcon={<AlertTriangle className="w-4 h-4" />}
        >
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Abre una excepción operacional de embarque (severidad alta) para seguimiento. No cambia el estado del embarque.
          </p>
          <div className="grid grid-cols-1 gap-4">
            <Field label="Tipo">
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="shp-input">
                {DISCREPANCY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Detalle">
              <textarea value={form.detail} onChange={(e) => setForm({ ...form, detail: e.target.value })} rows={3} placeholder="Qué se detectó al validar el empaque…" className="shp-input resize-y" />
            </Field>
          </div>
        </Modal>
      )}
    </>
  );
}

// ── Acción primaria de avance (fila de la lista) ─────────────────────────────
// Un único botón con la siguiente transición válida según el estado.
export function RowActions({ shipment, onChanged }: { shipment: Shipment; onChanged: () => void }) {
  switch (shipment.status) {
    case "planning":
      return <AddItemButton shipment={shipment} onChanged={onChanged} label="Surtir material" />;
    case "staged":
      return <StartLoadingButton shipment={shipment} onChanged={onChanged} />;
    case "loading":
      return <DispatchButton shipment={shipment} onChanged={onChanged} />;
    case "dispatched":
      return <CloseButton shipment={shipment} onChanged={onChanged} label="Cerrar" />;
    default:
      return (
        <span className="text-[12px] text-gray-500 dark:text-gray-400 inline-flex items-center gap-1">
          <Lock className="w-3.5 h-3.5" /> Cerrado
        </span>
      );
  }
}

// helper local para el resumen del despacho
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-gray-500 dark:text-gray-400">{k}</dt>
      <dd className="font-medium text-right truncate">{v}</dd>
    </div>
  );
}
