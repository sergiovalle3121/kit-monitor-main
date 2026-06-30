"use client";

// Interactive maintenance widgets shared across the lane. These are the pieces
// that hit the backend (POST /orders, POST /orders/:id/transition, PATCH
// /assets/:id) so the four views never duplicate a mutation. Each one validates
// against the same state machine the API enforces and reports via toast.
import React, { useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  FileOutput,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  Wrench,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/contexts/ToastContext";
import { Field, Modal } from "./maintenance.ui";
import {
  ASSET_STATUS_META,
  ASSET_STATUS_ORDER,
  COLORS,
  ORDER_STATUS_META,
  PM_FREQUENCY_META,
  PM_FREQUENCY_ORDER,
  PRIORITY_ORDER,
  PRIORITY_META,
  TYPE_META,
  TYPE_ORDER,
  nextOrderStates,
} from "./maintenance.utils";
import type {
  Asset,
  AssetStatus,
  CreateOrderInput,
  CreatePmPlanInput,
  MaintenanceOrder,
  MaintenanceOrderStatus,
  MaintenancePriority,
  MaintenanceType,
  PmFrequencyType,
  PmPlan,
  UpdatePmPlanInput,
} from "./maintenance.types";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000").replace(/\/$/, "");

// ── Crear orden de mantenimiento ─────────────────────────────────────────────
export function OrderFormModal({
  assets,
  prefill,
  onClose,
  onCreated,
}: {
  assets: Asset[];
  prefill?: Partial<CreateOrderInput>;
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: prefill?.title ?? "",
    description: prefill?.description ?? "",
    type: (prefill?.type ?? "CORRECTIVE") as MaintenanceType,
    priority: (prefill?.priority ?? "MEDIUM") as MaintenancePriority,
    assetId: prefill?.assetId ?? "",
    assignedTo: prefill?.assignedTo ?? "",
    dueDate: prefill?.dueDate ?? "",
  });

  async function submit() {
    if (form.title.trim().length < 3) {
      toast.error("Describe la orden (mín. 3 caracteres).", "Mantenimiento");
      return;
    }
    setBusy(true);
    try {
      const body: CreateOrderInput = {
        title: form.title.trim(),
        type: form.type,
        priority: form.priority,
        description: form.description.trim() || undefined,
        assetId: form.assetId || undefined,
        assignedTo: form.assignedTo.trim() || undefined,
        dueDate: form.dueDate || undefined,
      };
      const res = await apiFetch(`${API_BASE}/maintenance/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || "No se pudo crear la orden.", "Mantenimiento");
        return;
      }
      toast.success("Orden creada.", "Mantenimiento");
      onCreated();
      onClose();
    } catch {
      toast.error("Error de red.", "Mantenimiento");
    } finally {
      setBusy(false);
    }
  }

  const activeAssets = assets.filter((a) => a.status !== "RETIRED");

  return (
    <Modal
      title="Nueva orden de mantenimiento"
      icon={<Wrench className="w-4 h-4" style={{ color: COLORS.violet }} />}
      accent={COLORS.violet}
      busy={busy}
      onClose={onClose}
      onSubmit={submit}
      submitLabel="Crear orden"
      submitIcon={<CheckCircle2 className="w-4 h-4" />}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Trabajo a realizar" full>
          <input
            autoFocus
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Cambiar termopar zona 3"
            className="m-input"
          />
        </Field>
        <Field label="Activo / equipo">
          <select value={form.assetId} onChange={(e) => setForm({ ...form, assetId: e.target.value })} className="m-input">
            <option value="">— sin activo —</option>
            {activeAssets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.status === "DOWN" ? " (avería)" : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tipo">
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as MaintenanceType })} className="m-input">
            {TYPE_ORDER.map((t) => (
              <option key={t} value={t}>{TYPE_META[t].label}</option>
            ))}
          </select>
        </Field>
        <Field label="Prioridad">
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as MaintenancePriority })} className="m-input">
            {PRIORITY_ORDER.map((p) => (
              <option key={p} value={p}>{PRIORITY_META[p].label}</option>
            ))}
          </select>
        </Field>
        <Field label="Responsable">
          <input
            value={form.assignedTo}
            onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
            placeholder="Técnico asignado"
            className="m-input"
          />
        </Field>
        <Field label="Vence">
          <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="m-input" />
        </Field>
        <Field label="Notas / detalle" full>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Síntoma, refacciones, instrucciones…"
            rows={3}
            className="m-input resize-y"
          />
        </Field>
      </div>
    </Modal>
  );
}

// ── Controles de la máquina de estados (botones sólo de transiciones válidas) ─
const TRANSITION_ICON: Record<MaintenanceOrderStatus, React.ReactNode> = {
  OPEN: <RotateCcw className="w-3.5 h-3.5" />,
  IN_PROGRESS: <Play className="w-3.5 h-3.5" />,
  COMPLETED: <CheckCircle2 className="w-3.5 h-3.5" />,
  CANCELLED: <X className="w-3.5 h-3.5" />,
};

export function TransitionControls({
  order,
  onDone,
  className = "",
}: {
  order: MaintenanceOrder;
  onDone: () => void;
  className?: string;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<MaintenanceOrderStatus | null>(null);
  const [completing, setCompleting] = useState(false);
  const [downtime, setDowntime] = useState(String(order.downtimeMinutes || 0));
  const targets = nextOrderStates(order.status);

  async function go(to: MaintenanceOrderStatus, downtimeMinutes?: number) {
    setBusy(to);
    try {
      const body: { status: MaintenanceOrderStatus; downtimeMinutes?: number } = { status: to };
      if (downtimeMinutes !== undefined) body.downtimeMinutes = downtimeMinutes;
      const res = await apiFetch(`${API_BASE}/maintenance/orders/${order.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || "No se pudo actualizar.", "Mantenimiento");
        return;
      }
      toast.success(`→ ${ORDER_STATUS_META[to].label}`, "Mantenimiento");
      setCompleting(false);
      onDone();
    } catch {
      toast.error("Error de red.", "Mantenimiento");
    } finally {
      setBusy(null);
    }
  }

  if (targets.length === 0) {
    return (
      <span className="text-[12px] text-gray-500 dark:text-gray-400 inline-flex items-center gap-1">
        <CheckCircle2 className="w-3.5 h-3.5" /> Sin acciones (estado final)
      </span>
    );
  }

  return (
    <>
      <div className={`flex items-center gap-1.5 flex-wrap ${className}`}>
        {targets.map((to) => {
          const m = ORDER_STATUS_META[to];
          return (
            <button
              key={to}
              onClick={() => (to === "COMPLETED" ? setCompleting(true) : go(to))}
              disabled={busy !== null}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium disabled:opacity-50"
              style={{ background: `${m.color}1f`, color: m.color }}
              title={`Mover a ${m.label}`}
            >
              {busy === to ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : TRANSITION_ICON[to]}
              {to === "OPEN" ? "Reabrir" : m.label}
            </button>
          );
        })}
      </div>

      {completing && (
        <Modal
          title="Completar orden"
          icon={<CheckCircle2 className="w-4 h-4" style={{ color: COLORS.green }} />}
          accent={COLORS.green}
          busy={busy === "COMPLETED"}
          onClose={() => setCompleting(false)}
          onSubmit={() => go("COMPLETED", Math.max(0, Number(downtime) || 0))}
          submitLabel="Marcar completada"
          submitIcon={<CheckCircle2 className="w-4 h-4" />}
        >
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Registra el paro real del equipo. Alimenta el MTTR y el total de paro de los KPIs.
          </p>
          <Field label="Minutos de paro (downtime)">
            <div className="relative">
              <Clock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
              <input
                autoFocus
                type="number"
                min={0}
                value={downtime}
                onChange={(e) => setDowntime(e.target.value)}
                className="m-input pl-9"
              />
            </div>
          </Field>
        </Modal>
      )}
    </>
  );
}

// ── Control de estado del activo (operativo / inactivo / avería / retirado) ───
export function AssetStatusSelect({
  asset,
  onChanged,
}: {
  asset: Asset;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<AssetStatus | null>(null);

  async function set(status: AssetStatus) {
    if (status === asset.status) return;
    setBusy(status);
    try {
      const res = await apiFetch(`${API_BASE}/maintenance/assets/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || "No se pudo actualizar el activo.", "Mantenimiento");
        return;
      }
      toast.success(`${asset.name} → ${ASSET_STATUS_META[status].label}`, "Mantenimiento");
      onChanged();
    } catch {
      toast.error("Error de red.", "Mantenimiento");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="inline-flex items-center gap-1 p-0.5 rounded-lg bg-black/5 dark:bg-white/10">
      {ASSET_STATUS_ORDER.map((s) => {
        const m = ASSET_STATUS_META[s];
        const active = asset.status === s;
        return (
          <button
            key={s}
            onClick={() => set(s)}
            disabled={busy !== null}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors disabled:opacity-50"
            style={
              active
                ? { background: `${m.color}26`, color: m.color }
                : { color: "#9ca3af" }
            }
            title={m.label}
          >
            {busy === s ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: active ? m.color : "currentColor" }} />
            )}
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Botón "nueva orden" reutilizable ─────────────────────────────────────────
export function NewOrderButton({
  onClick,
  label = "Nueva orden",
  className = "",
}: {
  onClick: () => void;
  label?: string;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white ${className}`}
      style={{ background: COLORS.violet }}
    >
      <Plus className="w-4 h-4" /> {label}
    </button>
  );
}

// ── Alta / edición de plan de preventivo (PM) ────────────────────────────────
export function PmPlanFormModal({
  assets,
  plan,
  onClose,
  onSaved,
}: {
  assets: Asset[];
  plan?: PmPlan;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const isEdit = !!plan;
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: plan?.title ?? "",
    assetId: plan?.assetId ?? "",
    frequencyType: (plan?.frequencyType ?? "DAYS") as PmFrequencyType,
    frequencyValue: String(plan?.frequencyValue ?? 30),
    lastDoneDate: plan?.lastDoneDate ? plan.lastDoneDate.slice(0, 10) : "",
    assignedTo: plan?.assignedTo ?? "",
    description: plan?.description ?? "",
  });

  async function submit() {
    if (form.title.trim().length < 3) {
      toast.error("Describe el preventivo (mín. 3 caracteres).", "Mantenimiento");
      return;
    }
    const value = Math.max(1, Math.trunc(Number(form.frequencyValue) || 0));
    setBusy(true);
    try {
      let res: Response;
      if (isEdit && plan) {
        const body: UpdatePmPlanInput = {
          title: form.title.trim(),
          frequencyType: form.frequencyType,
          frequencyValue: value,
          assignedTo: form.assignedTo.trim() || undefined,
          description: form.description.trim() || undefined,
          lastDoneDate: form.lastDoneDate || undefined,
        };
        res = await apiFetch(`${API_BASE}/maintenance/pm-plans/${plan.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        const body: CreatePmPlanInput = {
          title: form.title.trim(),
          assetId: form.assetId || undefined,
          frequencyType: form.frequencyType,
          frequencyValue: value,
          assignedTo: form.assignedTo.trim() || undefined,
          description: form.description.trim() || undefined,
          lastDoneDate: form.lastDoneDate || undefined,
        };
        res = await apiFetch(`${API_BASE}/maintenance/pm-plans`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || "No se pudo guardar el preventivo.", "Mantenimiento");
        return;
      }
      toast.success(isEdit ? "Preventivo actualizado." : "Preventivo programado.", "Mantenimiento");
      onSaved();
      onClose();
    } catch {
      toast.error("Error de red.", "Mantenimiento");
    } finally {
      setBusy(false);
    }
  }

  const activeAssets = assets.filter((a) => a.status !== "RETIRED");
  const unit = PM_FREQUENCY_META[form.frequencyType];
  const freqN = Math.max(1, Math.trunc(Number(form.frequencyValue) || 0));

  return (
    <Modal
      title={isEdit ? "Editar preventivo" : "Programar preventivo"}
      icon={<CalendarClock className="w-4 h-4" style={{ color: COLORS.blue }} />}
      accent={COLORS.blue}
      busy={busy}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={isEdit ? "Guardar" : "Programar"}
      submitIcon={isEdit ? <CheckCircle2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Tarea preventiva" full>
          <input
            autoFocus
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Lubricación y limpieza de rieles"
            className="m-input"
          />
        </Field>
        <Field label="Activo / equipo" hint={isEdit ? "El activo se fija al programar." : undefined}>
          <select
            value={form.assetId}
            onChange={(e) => setForm({ ...form, assetId: e.target.value })}
            className="m-input"
            disabled={isEdit}
          >
            <option value="">— sin activo —</option>
            {activeAssets.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Responsable">
          <input
            value={form.assignedTo}
            onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
            placeholder="Planeador / técnico"
            className="m-input"
          />
        </Field>
        <Field label="Cada">
          <input
            type="number"
            min={1}
            value={form.frequencyValue}
            onChange={(e) => setForm({ ...form, frequencyValue: e.target.value })}
            className="m-input"
          />
        </Field>
        <Field label="Unidad">
          <select
            value={form.frequencyType}
            onChange={(e) => setForm({ ...form, frequencyType: e.target.value as PmFrequencyType })}
            className="m-input"
          >
            {PM_FREQUENCY_ORDER.map((t) => (
              <option key={t} value={t}>{PM_FREQUENCY_META[t].many}</option>
            ))}
          </select>
        </Field>
        <Field label="Última realización" full hint={`Si la dejas vacía, el primer vencimiento se calcula desde hoy (cada ${freqN} ${freqN === 1 ? unit.one : unit.many}).`}>
          <input
            type="date"
            value={form.lastDoneDate}
            onChange={(e) => setForm({ ...form, lastDoneDate: e.target.value })}
            className="m-input"
          />
        </Field>
        <Field label="Notas / checklist" full>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Pasos, refacciones, puntos de inspección…"
            rows={3}
            className="m-input resize-y"
          />
        </Field>
      </div>
    </Modal>
  );
}

// ── Botón "Generar orden de PM" ──────────────────────────────────────────────
export function GeneratePmOrderButton({
  plan,
  onDone,
  className = "",
}: {
  plan: PmPlan;
  onDone: () => void;
  className?: string;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/maintenance/pm-plans/${plan.id}/generate-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || "No se pudo generar la orden.", "Mantenimiento");
        return;
      }
      const data = await res.json().catch(() => ({}));
      const folio = data?.order?.folio;
      toast.success(folio ? `Orden ${folio} generada.` : "Orden de PM generada.", "Mantenimiento");
      onDone();
    } catch {
      toast.error("Error de red.", "Mantenimiento");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={generate}
      disabled={busy}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-white disabled:opacity-60 ${className}`}
      style={{ background: COLORS.blue }}
      title="Genera la orden de trabajo preventiva y reprograma la próxima fecha"
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileOutput className="w-3.5 h-3.5" />}
      Generar orden
    </button>
  );
}
