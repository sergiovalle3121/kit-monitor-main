"use client";

// Work-order workbench: filterable list, a detail drawer, edit, and the state
// machine surfaced as valid-only transitions (POST /maintenance/orders/:id/
// transition). The drawer reads straight from the in-memory list (GET /orders
// already returns the full entity), so no extra round-trip is needed.
import React, { useMemo, useState } from "react";
import {
  Calendar,
  Clock,
  Inbox,
  Pencil,
  Play,
  Plus,
  Save,
  Search,
  User,
  Wrench,
  X,
} from "lucide-react";
import { glass } from "@/lib/glass";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/contexts/ToastContext";
import { ExportButton, type ExportColumn } from "@/components/workspace";
import {
  Empty,
  Field,
  PriorityPill,
  StatusPill,
  TypePill,
} from "./maintenance.ui";
import { TransitionControls } from "./maintenance.actions";
import {
  COLORS,
  ORDER_STATUS_META,
  ORDER_STATUS_ORDER,
  PRIORITY_META,
  PRIORITY_ORDER,
  TYPE_META,
  TYPE_ORDER,
  compareWorkOrders,
  dueLabel,
  fmtDate,
  fmtDateTime,
  fmtMinutes,
  isOverdue,
} from "./maintenance.utils";
import type {
  Asset,
  CreateOrderInput,
  MaintenanceOrder,
  MaintenanceOrderStatus,
  MaintenancePriority,
  MaintenanceType,
  UpdateOrderInput,
} from "./maintenance.types";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000").replace(/\/$/, "");

// Columnas de exportación de órdenes (el padre entrega el dataset ya filtrado).
const ORDER_EXPORT_COLUMNS: ExportColumn<MaintenanceOrder>[] = [
  { key: "folio", header: "Folio" },
  { key: "title", header: "Título" },
  { key: "type", header: "Tipo", value: (o) => TYPE_META[o.type]?.label ?? o.type },
  { key: "assetName", header: "Activo" },
  { key: "priority", header: "Prioridad", value: (o) => PRIORITY_META[o.priority]?.label ?? o.priority },
  { key: "status", header: "Estado", value: (o) => ORDER_STATUS_META[o.status]?.label ?? o.status },
  { key: "assignedTo", header: "Asignado a" },
  { key: "downtimeMinutes", header: "Paro (min)", value: (o) => o.downtimeMinutes ?? 0 },
  { key: "dueDate", header: "Vence", value: (o) => fmtDate(o.dueDate) },
  { key: "completedAt", header: "Completada", value: (o) => fmtDate(o.completedAt) },
];

export function OrdersTab({
  orders,
  assets,
  onNewOrder,
  refresh,
}: {
  orders: MaintenanceOrder[];
  assets: Asset[];
  onNewOrder: (prefill?: Partial<CreateOrderInput>) => void;
  refresh: () => void;
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<MaintenanceOrderStatus | "">("");
  const [type, setType] = useState<MaintenanceType | "">("");
  const [assetId, setAssetId] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const counts = useMemo(() => {
    const c: Record<string, number> = { "": orders.length };
    for (const s of ORDER_STATUS_ORDER) c[s] = 0;
    for (const o of orders) c[o.status] = (c[o.status] ?? 0) + 1;
    return c;
  }, [orders]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return orders
      .filter((o) => {
        if (status && o.status !== status) return false;
        if (type && o.type !== type) return false;
        if (assetId && o.assetId !== assetId) return false;
        if (needle) {
          const hay = `${o.folio ?? ""} ${o.title} ${o.assetName ?? ""} ${o.assignedTo ?? ""} ${o.description ?? ""}`.toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        return true;
      })
      .sort(compareWorkOrders);
  }, [orders, q, status, type, assetId]);

  const selected = selectedId ? orders.find((o) => o.id === selectedId) ?? null : null;
  const anyFilter = !!(q || status || type || assetId);

  return (
    <div className="space-y-4">
      {/* Buscador + filtros secundarios + alta */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar folio, título, activo, responsable…" className="m-input pl-9" />
        </div>
        <select value={type} onChange={(e) => setType(e.target.value as MaintenanceType | "")} className="m-input w-auto">
          <option value="">Tipo: todos</option>
          {TYPE_ORDER.map((t) => (
            <option key={t} value={t}>{TYPE_META[t].label}</option>
          ))}
        </select>
        <select value={assetId} onChange={(e) => setAssetId(e.target.value)} className="m-input w-auto">
          <option value="">Activo: todos</option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <ExportButton rows={rows} columns={ORDER_EXPORT_COLUMNS} filename="ordenes-mantenimiento" formats={["csv"]} label="Exportar" />
        <button onClick={() => onNewOrder()} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white" style={{ background: COLORS.violet }}>
          <Plus className="w-4 h-4" /> Nueva orden
        </button>
      </div>

      {/* Filtro de estado segmentado, con conteos */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <StatusChip label="Todas" count={counts[""]} active={status === ""} color={COLORS.gray} onClick={() => setStatus("")} />
        {ORDER_STATUS_ORDER.map((s) => (
          <StatusChip
            key={s}
            label={ORDER_STATUS_META[s].label}
            count={counts[s] ?? 0}
            active={status === s}
            color={ORDER_STATUS_META[s].color}
            onClick={() => setStatus(status === s ? "" : s)}
          />
        ))}
      </div>

      {/* Lista */}
      {orders.length === 0 ? (
        <div className={`${glass} rounded-2xl`}>
          <Empty
            icon={<Wrench className="w-7 h-7" />}
            title="Sin órdenes de mantenimiento"
            body="Crea la primera orden (preventiva o correctiva) para empezar a medir MTTR, % PM y el paro por equipo."
            cta={
              <button onClick={() => onNewOrder()} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: COLORS.violet }}>
                <Plus className="w-4 h-4" /> Nueva orden
              </button>
            }
          />
        </div>
      ) : rows.length === 0 ? (
        <div className={`${glass} rounded-2xl p-10 text-center`}>
          <Inbox className="w-7 h-7 mx-auto mb-2 text-gray-500 dark:text-gray-400" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Ninguna orden coincide con el filtro.</p>
          {anyFilter && (
            <button onClick={() => { setQ(""); setStatus(""); setType(""); setAssetId(""); }} className="mt-3 text-[13px] underline underline-offset-2 text-gray-500">
              Limpiar filtros
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {rows.map((o) => (
            <OrderRow key={o.id} order={o} onOpen={() => { setSelectedId(o.id); setEditing(false); }} onChanged={refresh} />
          ))}
        </div>
      )}

      {selected && (
        <OrderDrawer
          order={selected}
          assets={assets}
          editing={editing}
          onEdit={() => setEditing(true)}
          onStopEdit={() => setEditing(false)}
          onClose={() => { setSelectedId(null); setEditing(false); }}
          onChanged={refresh}
        />
      )}
    </div>
  );
}

// ── Fila de orden ────────────────────────────────────────────────────────────
function OrderRow({
  order,
  onOpen,
  onChanged,
}: {
  order: MaintenanceOrder;
  onOpen: () => void;
  onChanged: () => void;
}) {
  const overdue = isOverdue(order);
  return (
    <div className={`${glass} rounded-2xl p-4`}>
      <div className="flex items-start gap-3">
        <button onClick={onOpen} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2 flex-wrap">
            {order.folio && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500">{order.folio}</span>}
            <span className="font-semibold truncate">{order.title}</span>
            <StatusPill status={order.status} />
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-[12px] text-gray-500 dark:text-gray-400 flex-wrap">
            <TypePill type={order.type} />
            {order.priority === "HIGH" && <PriorityPill priority="HIGH" />}
            {order.assetName && <span className="inline-flex items-center gap-1"><Wrench className="w-3 h-3" />{order.assetName}</span>}
            {order.assignedTo && <span className="inline-flex items-center gap-1"><User className="w-3 h-3" />{order.assignedTo}</span>}
            {order.dueDate && (
              <span className="inline-flex items-center gap-1" style={overdue ? { color: COLORS.red } : undefined}>
                <Calendar className="w-3 h-3" />{dueLabel(order.dueDate)}
              </span>
            )}
            {order.downtimeMinutes > 0 && <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{fmtMinutes(order.downtimeMinutes)} paro</span>}
          </div>
        </button>
        <div className="flex-shrink-0">
          <TransitionControls order={order} onDone={onChanged} />
        </div>
      </div>
    </div>
  );
}

// ── Drawer de detalle ────────────────────────────────────────────────────────
function OrderDrawer({
  order,
  assets,
  editing,
  onEdit,
  onStopEdit,
  onClose,
  onChanged,
}: {
  order: MaintenanceOrder;
  assets: Asset[];
  editing: boolean;
  onEdit: () => void;
  onStopEdit: () => void;
  onClose: () => void;
  onChanged: () => void;
}) {
  const asset = order.assetId ? assets.find((a) => a.id === order.assetId) ?? null : null;
  const overdue = isOverdue(order);
  return (
    <div className="fixed inset-0 z-[110]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`${glass} absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto`}>
        <div className="sticky top-0 z-10 px-5 py-4 flex items-center gap-3 border-b border-black/5 dark:border-white/10 bg-white/60 dark:bg-neutral-900/60 backdrop-blur-xl">
          <span className="w-9 h-9 rounded-xl grid place-items-center flex-shrink-0" style={{ background: `${ORDER_STATUS_META[order.status].color}1f` }}>
            <Wrench className="w-5 h-5" style={{ color: ORDER_STATUS_META[order.status].color }} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {order.folio && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500">{order.folio}</span>}
              <StatusPill status={order.status} />
            </div>
            <h3 className="font-semibold truncate mt-0.5">{order.title}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>

        {editing ? (
          <OrderEditForm order={order} onCancel={onStopEdit} onSaved={() => { onStopEdit(); onChanged(); }} />
        ) : (
          <div className="p-5 space-y-5">
            <div className="flex items-center gap-2 flex-wrap">
              <TypePill type={order.type} />
              <PriorityPill priority={order.priority} />
            </div>

            <dl className="space-y-2.5 text-sm">
              <DetailRow icon={<Wrench className="w-4 h-4" />} label="Activo" value={order.assetName ?? "Sin activo"} sub={asset ? [asset.code, asset.location].filter(Boolean).join(" · ") : undefined} />
              <DetailRow icon={<User className="w-4 h-4" />} label="Responsable" value={order.assignedTo ?? "Sin asignar"} />
              <DetailRow
                icon={<Calendar className="w-4 h-4" />}
                label="Vence"
                value={order.dueDate ? dueLabel(order.dueDate) : "Sin fecha"}
                valueColor={overdue ? COLORS.red : undefined}
              />
              <DetailRow icon={<Clock className="w-4 h-4" />} label="Paro registrado" value={fmtMinutes(order.downtimeMinutes)} />
            </dl>

            {order.description && (
              <div>
                <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Detalle</div>
                <p className="text-sm whitespace-pre-wrap text-gray-700 dark:text-gray-300">{order.description}</p>
              </div>
            )}

            {/* Línea de tiempo */}
            <div>
              <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">Línea de tiempo</div>
              <div className="space-y-2">
                <TimelineRow icon={<Plus className="w-3.5 h-3.5" />} label="Creada" at={order.created_at} done />
                <TimelineRow icon={<Play className="w-3.5 h-3.5" />} label="Iniciada" at={order.startedAt} done={!!order.startedAt} />
                <TimelineRow icon={<Clock className="w-3.5 h-3.5" />} label="Completada" at={order.completedAt} done={!!order.completedAt} />
              </div>
            </div>

            {/* Máquina de estados */}
            <div className="pt-4 border-t border-black/5 dark:border-white/10">
              <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">Acciones</div>
              <TransitionControls order={order} onDone={onChanged} />
            </div>

            <button onClick={onEdit} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10 w-full justify-center">
              <Pencil className="w-4 h-4" /> Editar orden
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
  sub,
  valueColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-gray-500 dark:text-gray-400 mt-0.5">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] text-gray-500 dark:text-gray-400">{label}</div>
        <div className="text-sm" style={valueColor ? { color: valueColor } : undefined}>{value}</div>
        {sub && <div className="text-[12px] text-gray-500 dark:text-gray-400 truncate">{sub}</div>}
      </div>
    </div>
  );
}

function TimelineRow({
  icon,
  label,
  at,
  done,
}: {
  icon: React.ReactNode;
  label: string;
  at?: string | null;
  done: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="w-6 h-6 rounded-full grid place-items-center flex-shrink-0"
        style={done ? { background: `${COLORS.violet}1f`, color: COLORS.violet } : { background: "rgba(107,114,128,0.12)", color: COLORS.gray }}
      >
        {icon}
      </span>
      <span className="text-sm flex-1">{label}</span>
      <span className="text-[12px] text-gray-500 dark:text-gray-400">{at ? fmtDateTime(at) : "—"}</span>
    </div>
  );
}

// ── Edición de orden (PATCH) ─────────────────────────────────────────────────
function OrderEditForm({
  order,
  onCancel,
  onSaved,
}: {
  order: MaintenanceOrder;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: order.title,
    description: order.description ?? "",
    type: order.type,
    priority: order.priority,
    assignedTo: order.assignedTo ?? "",
    dueDate: order.dueDate ? order.dueDate.slice(0, 10) : "",
  });

  async function save() {
    if (form.title.trim().length < 3) {
      toast.error("El título debe tener al menos 3 caracteres.", "Mantenimiento");
      return;
    }
    setBusy(true);
    try {
      const body: UpdateOrderInput = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        type: form.type,
        priority: form.priority,
        assignedTo: form.assignedTo.trim() || undefined,
        dueDate: form.dueDate || undefined,
      };
      const res = await apiFetch(`${API_BASE}/maintenance/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || "No se pudo guardar.", "Mantenimiento");
        return;
      }
      toast.success("Orden actualizada.", "Mantenimiento");
      onSaved();
    } catch {
      toast.error("Error de red.", "Mantenimiento");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-5 space-y-4">
      <Field label="Trabajo a realizar">
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="m-input" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
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
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Responsable">
          <input value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} className="m-input" />
        </Field>
        <Field label="Vence">
          <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="m-input" />
        </Field>
      </div>
      <Field label="Notas / detalle">
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} className="m-input resize-y" />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
        <button onClick={save} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: COLORS.violet }}>
          <Save className="w-4 h-4" /> Guardar
        </button>
      </div>
      {/* Reutiliza los estilos .m-input del modal global. */}
    </div>
  );
}

// ── Chip de estado (filtro) ──────────────────────────────────────────────────
function StatusChip({
  label,
  count,
  active,
  color,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[13px] font-medium transition-colors ${
        active ? "text-white" : "hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400"
      }`}
      style={active ? { background: color } : undefined}
    >
      {label}
      <span className={`text-[11px] px-1.5 rounded-full tabular-nums ${active ? "bg-white/25" : "bg-black/5 dark:bg-white/10"}`}>{count}</span>
    </button>
  );
}
