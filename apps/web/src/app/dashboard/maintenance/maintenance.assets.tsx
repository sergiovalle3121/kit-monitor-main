"use client";

// Asset registry (CMMS equipment master): list with search/filters, create with
// the full CreateAssetDto, and edit limited to what PATCH /maintenance/assets/:id
// actually accepts (name, category, location, criticality, status). Identity
// fields (code, manufacturer, model, serial) are set at creation and shown
// read-only on edit — honest about the backend's update surface.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Calendar,
  Clock,
  Gauge,
  HardDrive,
  Inbox,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Save,
  Search,
  Tag,
  Timer,
  Wrench,
  X,
} from "lucide-react";
import { glass } from "@/lib/glass";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/contexts/ToastContext";
import { ExportButton, type ExportColumn } from "@/components/workspace";
import {
  AssetStatusPill,
  CriticalityPill,
  Empty,
  Field,
  Modal,
  Pill,
  StatusPill,
  TypePill,
} from "./maintenance.ui";
import { AssetStatusSelect } from "./maintenance.actions";
import {
  ASSET_STATUS_META,
  ASSET_STATUS_ORDER,
  COLORS,
  CRITICALITY_META,
  CRITICALITY_ORDER,
  dueLabel,
  fmtDate,
  fmtDateTime,
  fmtHours,
  fmtMinutes,
  isOrderActive,
} from "./maintenance.utils";
import type {
  Asset,
  AssetCriticality,
  AssetDetail,
  AssetStatus,
  CreateAssetInput,
  CreateOrderInput,
  MaintenanceOrder,
} from "./maintenance.types";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000").replace(/\/$/, "");

// Columnas de exportación del registro de activos (respeta los filtros del padre).
const ASSET_EXPORT_COLUMNS: ExportColumn<Asset>[] = [
  { key: "code", header: "Código" },
  { key: "name", header: "Nombre" },
  { key: "category", header: "Categoría" },
  { key: "location", header: "Ubicación" },
  { key: "criticality", header: "Criticidad", value: (a) => CRITICALITY_META[a.criticality]?.label ?? a.criticality },
  { key: "status", header: "Estado", value: (a) => ASSET_STATUS_META[a.status]?.label ?? a.status },
  { key: "manufacturer", header: "Fabricante" },
  { key: "model", header: "Modelo" },
  { key: "serialNumber", header: "No. de serie" },
];

export function AssetsTab({
  assets,
  orders,
  onNewOrder,
  refresh,
}: {
  assets: Asset[];
  orders: MaintenanceOrder[];
  onNewOrder: (prefill?: Partial<CreateOrderInput>) => void;
  refresh: () => void;
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<AssetStatus | "">("");
  const [criticality, setCriticality] = useState<AssetCriticality | "">("");
  const [editing, setEditing] = useState<Asset | null>(null);
  const [creating, setCreating] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  // Órdenes vivas por activo (derivado del listado).
  const openByAsset = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of orders) {
      if (!o.assetId || !isOrderActive(o.status)) continue;
      map.set(o.assetId, (map.get(o.assetId) ?? 0) + 1);
    }
    return map;
  }, [orders]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return assets.filter((a) => {
      if (status && a.status !== status) return false;
      if (criticality && a.criticality !== criticality) return false;
      if (needle) {
        const hay = `${a.name} ${a.code ?? ""} ${a.category ?? ""} ${a.location ?? ""} ${a.manufacturer ?? ""} ${a.model ?? ""} ${a.serialNumber ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [assets, q, status, criticality]);

  const anyFilter = !!(q || status || criticality);

  return (
    <div className="space-y-5">
      {/* Filtros + alta */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar activo, código, ubicación…"
            className="m-input pl-9"
          />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as AssetStatus | "")} className="m-input w-auto">
          <option value="">Estado: todos</option>
          {ASSET_STATUS_ORDER.map((s) => (
            <option key={s} value={s}>{ASSET_STATUS_META[s].label}</option>
          ))}
        </select>
        <select value={criticality} onChange={(e) => setCriticality(e.target.value as AssetCriticality | "")} className="m-input w-auto">
          <option value="">Criticidad: toda</option>
          {CRITICALITY_ORDER.map((c) => (
            <option key={c} value={c}>{CRITICALITY_META[c].label}</option>
          ))}
        </select>
        <ExportButton rows={rows} columns={ASSET_EXPORT_COLUMNS} filename="activos-mantenimiento" formats={["csv"]} label="Exportar" />
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white"
          style={{ background: COLORS.violet }}
        >
          <Plus className="w-4 h-4" /> Alta de activo
        </button>
      </div>

      {/* Lista */}
      {assets.length === 0 ? (
        <div className={`${glass} rounded-2xl`}>
          <Empty
            icon={<HardDrive className="w-7 h-7" />}
            title="Sin activos registrados"
            body="Da de alta tus equipos críticos para asociarles órdenes, medir su paro y priorizar el mantenimiento."
            cta={
              <button onClick={() => setCreating(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: COLORS.violet }}>
                <Plus className="w-4 h-4" /> Alta de activo
              </button>
            }
          />
        </div>
      ) : rows.length === 0 ? (
        <div className={`${glass} rounded-2xl p-10 text-center`}>
          <Inbox className="w-7 h-7 mx-auto mb-2 text-gray-400" />
          <p className="text-sm text-gray-400">Ningún activo coincide con el filtro.</p>
          {anyFilter && (
            <button onClick={() => { setQ(""); setStatus(""); setCriticality(""); }} className="mt-3 text-[13px] underline underline-offset-2 text-gray-500">
              Limpiar filtros
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {rows.map((a) => {
            const down = a.status === "DOWN";
            const open = openByAsset.get(a.id) ?? 0;
            return (
              <div
                key={a.id}
                className={`${glass} rounded-2xl p-4 ${down ? "ring-1" : ""}`}
                style={down ? { boxShadow: `inset 0 0 0 1px ${COLORS.red}55` } : undefined}
              >
                <div className="flex items-start gap-2">
                  <button onClick={() => setDetailId(a.id)} className="min-w-0 flex-1 text-left" title="Ver detalle y confiabilidad">
                    <div className="flex items-center gap-2 flex-wrap">
                      {a.code && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500">{a.code}</span>}
                      <span className="font-semibold truncate">{a.name}</span>
                      <CriticalityPill criticality={a.criticality} />
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[12px] text-gray-400 flex-wrap">
                      {a.category && <span className="inline-flex items-center gap-1"><Tag className="w-3 h-3" />{a.category}</span>}
                      {a.location && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{a.location}</span>}
                      {(a.manufacturer || a.model) && <span>{[a.manufacturer, a.model].filter(Boolean).join(" ")}</span>}
                      {a.serialNumber && <span className="font-mono">S/N {a.serialNumber}</span>}
                    </div>
                  </button>
                  <button
                    onClick={() => setEditing(a)}
                    className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-400"
                    title="Editar activo"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>

                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <AssetStatusSelect asset={a} onChanged={refresh} />
                  {open > 0 && (
                    <Pill label={`${open} ${open === 1 ? "orden abierta" : "órdenes abiertas"}`} color={COLORS.amber} />
                  )}
                  <button
                    onClick={() =>
                      onNewOrder({
                        assetId: a.id,
                        type: down ? "CORRECTIVE" : "PREVENTIVE",
                        priority: down ? "HIGH" : "MEDIUM",
                        title: down ? `Avería: ${a.name}` : "",
                      })
                    }
                    className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium hover:bg-black/5 dark:hover:bg-white/10"
                    style={{ color: COLORS.violet }}
                  >
                    <Wrench className="w-3.5 h-3.5" /> Nueva orden
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {creating && <AssetFormModal onClose={() => setCreating(false)} onSaved={refresh} />}
      {editing && <AssetFormModal asset={editing} onClose={() => setEditing(null)} onSaved={refresh} />}
      {detailId && (
        <AssetDetailDrawer
          assetId={detailId}
          onClose={() => setDetailId(null)}
          onEdit={(a) => { setDetailId(null); setEditing(a); }}
          onNewOrder={onNewOrder}
          onChanged={refresh}
        />
      )}
    </div>
  );
}

// ── Drawer de detalle de activo: historial + confiabilidad (MTTR/MTBF) ───────
function AssetDetailDrawer({
  assetId,
  onClose,
  onEdit,
  onNewOrder,
  onChanged,
}: {
  assetId: string;
  onClose: () => void;
  onEdit: (a: Asset) => void;
  onNewOrder: (prefill?: Partial<CreateOrderInput>) => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<AssetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await apiFetch(`${API_BASE}/maintenance/assets/${assetId}`);
      if (!res.ok) { setError(true); return; }
      setDetail(await res.json());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  // Carga al abrir / cambiar de activo; `load` se reusa para reintentar y refrescar.
  useEffect(() => { load(); }, [load]);

  const asset = detail?.asset ?? null;
  const r = detail?.reliability ?? null;
  const orders = detail?.orders ?? [];
  const down = asset?.status === "DOWN";

  return (
    <div className="fixed inset-0 z-[110]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`${glass} absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto`}>
        <div className="sticky top-0 z-10 px-5 py-4 flex items-center gap-3 border-b border-black/5 dark:border-white/10 bg-white/60 dark:bg-neutral-900/60 backdrop-blur-xl">
          <span className="w-9 h-9 rounded-xl grid place-items-center flex-shrink-0" style={{ background: down ? `${COLORS.red}1f` : `${COLORS.violet}1f` }}>
            <HardDrive className="w-5 h-5" style={{ color: down ? COLORS.red : COLORS.violet }} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold truncate">{asset?.name ?? "Activo"}</h3>
            <div className="text-[12px] text-gray-400 truncate">
              {asset ? [asset.code, asset.location].filter(Boolean).join(" · ") || "Sin ubicación" : ""}
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>

        {loading ? (
          <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : error || !asset || !r ? (
          <div className="p-8 text-center text-sm text-gray-400">
            No se pudo cargar el detalle del activo.
            <button onClick={load} className="block mx-auto mt-3 text-[13px] underline underline-offset-2">Reintentar</button>
          </div>
        ) : (
          <div className="p-5 space-y-5">
            <div className="flex items-center gap-2 flex-wrap">
              <AssetStatusPill status={asset.status} />
              <CriticalityPill criticality={asset.criticality} />
              {(asset.manufacturer || asset.model) && (
                <span className="text-[12px] text-gray-400">{[asset.manufacturer, asset.model].filter(Boolean).join(" ")}</span>
              )}
            </div>

            {/* Cambio de estado operativo (semáforo) */}
            <div>
              <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-2">Estado operativo</div>
              <AssetStatusSelect asset={asset} onChanged={() => { onChanged(); load(); }} />
            </div>

            {/* Confiabilidad: MTTR / MTBF / fallas / paro */}
            <div>
              <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-2 flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5" /> Confiabilidad
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <MiniKpi icon={<Timer className="w-3.5 h-3.5" />} label="MTTR" value={fmtHours(r.mttrHours)} sub="reparación media" color={COLORS.violet} />
                <MiniKpi icon={<Activity className="w-3.5 h-3.5" />} label="MTBF" value={fmtHours(r.mtbfHours)} sub={r.mtbfHours == null ? "≥2 fallas" : "entre fallas"} color={r.mtbfHours == null ? COLORS.gray : COLORS.violet} />
                <MiniKpi icon={<Wrench className="w-3.5 h-3.5" />} label="Fallas" value={r.failures} sub="órdenes correctivas" color={r.failures > 0 ? COLORS.orange : COLORS.green} />
                <MiniKpi icon={<Clock className="w-3.5 h-3.5" />} label="Paro acumulado" value={fmtMinutes(r.totalDowntimeMinutes)} sub={`${r.openOrders} abiertas`} color={COLORS.amber} />
              </div>
              {r.lastFailureAt && (
                <div className="text-[11px] text-gray-400 mt-2">Última falla: {fmtDateTime(r.lastFailureAt)}</div>
              )}
            </div>

            {/* Acción rápida */}
            <button
              onClick={() => onNewOrder({ assetId: asset.id, type: down ? "CORRECTIVE" : "PREVENTIVE", priority: down ? "HIGH" : "MEDIUM", title: down ? `Avería: ${asset.name}` : "" })}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white w-full justify-center"
              style={{ background: down ? COLORS.red : COLORS.violet }}
            >
              <Wrench className="w-4 h-4" /> {down ? "Orden correctiva" : "Nueva orden"}
            </button>

            {/* Historial de órdenes (correctivas y preventivas) */}
            <div>
              <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-2">Historial de órdenes ({orders.length})</div>
              {orders.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">Sin órdenes para este activo todavía.</p>
              ) : (
                <div className="space-y-2">
                  {orders.map((o) => <HistoryRow key={o.id} order={o} />)}
                </div>
              )}
            </div>

            <button onClick={() => onEdit(asset)} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10 w-full justify-center">
              <Pencil className="w-4 h-4" /> Editar activo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniKpi({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="rounded-xl p-3 bg-black/[0.03] dark:bg-white/[0.04]">
      <div className="text-[11px] uppercase tracking-wide text-gray-400 flex items-center gap-1">{icon}{label}</div>
      <div className="text-lg font-semibold mt-0.5" style={{ color }}>{value}</div>
      {sub && <div className="text-[11px] text-gray-400 truncate">{sub}</div>}
    </div>
  );
}

function HistoryRow({ order }: { order: MaintenanceOrder }) {
  return (
    <div className="rounded-xl p-3 bg-black/[0.03] dark:bg-white/[0.04]">
      <div className="flex items-center gap-2 flex-wrap">
        {order.folio && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500">{order.folio}</span>}
        <span className="text-sm font-medium truncate flex-1 min-w-0">{order.title}</span>
        <StatusPill status={order.status} />
      </div>
      <div className="mt-1.5 flex items-center gap-2 text-[12px] text-gray-400 flex-wrap">
        <TypePill type={order.type} />
        {order.dueDate && <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" />{dueLabel(order.dueDate)}</span>}
        {order.downtimeMinutes > 0 && <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{fmtMinutes(order.downtimeMinutes)} paro</span>}
        {order.completedAt && <span>Cerrada {fmtDate(order.completedAt)}</span>}
      </div>
    </div>
  );
}

// ── Alta / edición de activo ─────────────────────────────────────────────────
function AssetFormModal({
  asset,
  onClose,
  onSaved,
}: {
  asset?: Asset;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const isEdit = !!asset;
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: asset?.name ?? "",
    code: asset?.code ?? "",
    category: asset?.category ?? "",
    location: asset?.location ?? "",
    criticality: (asset?.criticality ?? "MEDIUM") as AssetCriticality,
    status: (asset?.status ?? "RUNNING") as AssetStatus,
    manufacturer: asset?.manufacturer ?? "",
    model: asset?.model ?? "",
    serialNumber: asset?.serialNumber ?? "",
  });

  async function submit() {
    if (form.name.trim().length < 2) {
      toast.error("El nombre debe tener al menos 2 caracteres.", "Mantenimiento");
      return;
    }
    setBusy(true);
    try {
      let res: Response;
      if (isEdit && asset) {
        // PATCH sólo acepta estos campos.
        res = await apiFetch(`${API_BASE}/maintenance/assets/${asset.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            category: form.category.trim() || undefined,
            location: form.location.trim() || undefined,
            criticality: form.criticality,
            status: form.status,
          }),
        });
      } else {
        const body: CreateAssetInput = {
          name: form.name.trim(),
          code: form.code.trim() || undefined,
          category: form.category.trim() || undefined,
          location: form.location.trim() || undefined,
          criticality: form.criticality,
          manufacturer: form.manufacturer.trim() || undefined,
          model: form.model.trim() || undefined,
          serialNumber: form.serialNumber.trim() || undefined,
        };
        res = await apiFetch(`${API_BASE}/maintenance/assets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || "No se pudo guardar.", "Mantenimiento");
        return;
      }
      toast.success(isEdit ? "Activo actualizado." : "Activo dado de alta.", "Mantenimiento");
      onSaved();
      onClose();
    } catch {
      toast.error("Error de red.", "Mantenimiento");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={isEdit ? "Editar activo" : "Alta de activo"}
      icon={<HardDrive className="w-4 h-4" style={{ color: COLORS.violet }} />}
      accent={COLORS.violet}
      busy={busy}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={isEdit ? "Guardar" : "Dar de alta"}
      submitIcon={isEdit ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Nombre del equipo" full>
          <input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Horno de reflujo SMT-1" className="m-input" />
        </Field>
        <Field
          label="Código"
          hint={isEdit ? "Se fija al dar de alta (PATCH no lo modifica)." : undefined}
        >
          <input
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            placeholder="EQ-SMT-001"
            className="m-input"
            disabled={isEdit}
          />
        </Field>
        <Field label="Categoría">
          <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="SMT / Horno" className="m-input" />
        </Field>
        <Field label="Ubicación">
          <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Línea 2 · Nave A" className="m-input" />
        </Field>
        <Field label="Criticidad">
          <select value={form.criticality} onChange={(e) => setForm({ ...form, criticality: e.target.value as AssetCriticality })} className="m-input">
            {CRITICALITY_ORDER.map((c) => (
              <option key={c} value={c}>{CRITICALITY_META[c].label}</option>
            ))}
          </select>
        </Field>
        {isEdit ? (
          <Field label="Estado">
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as AssetStatus })} className="m-input">
              {ASSET_STATUS_ORDER.map((s) => (
                <option key={s} value={s}>{ASSET_STATUS_META[s].label}</option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label="Fabricante">
            <input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} placeholder="Heller / Yamaha…" className="m-input" />
          </Field>
        )}
        {isEdit ? (
          <>
            <Field label="Fabricante" hint="Se fija al dar de alta.">
              <input value={form.manufacturer} className="m-input" disabled />
            </Field>
            <Field label="Modelo" hint="Se fija al dar de alta.">
              <input value={form.model} className="m-input" disabled />
            </Field>
            <Field label="No. de serie" hint="Se fija al dar de alta.">
              <input value={form.serialNumber} className="m-input" disabled />
            </Field>
          </>
        ) : (
          <>
            <Field label="Modelo">
              <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="1809 MK5" className="m-input" />
            </Field>
            <Field label="No. de serie" full>
              <input value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} placeholder="SN-0000-XXXX" className="m-input" />
            </Field>
          </>
        )}
      </div>
    </Modal>
  );
}
