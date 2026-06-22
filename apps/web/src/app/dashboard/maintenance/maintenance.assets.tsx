"use client";

// Asset registry (CMMS equipment master): list with search/filters, create with
// the full CreateAssetDto, and edit limited to what PATCH /maintenance/assets/:id
// actually accepts (name, category, location, criticality, status). Identity
// fields (code, manufacturer, model, serial) are set at creation and shown
// read-only on edit — honest about the backend's update surface.
import React, { useMemo, useState } from "react";
import {
  ClipboardList,
  Clock,
  HardDrive,
  Inbox,
  MapPin,
  Pencil,
  Plus,
  Save,
  Search,
  Tag,
  Wrench,
} from "lucide-react";
import { glass } from "@/lib/glass";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/contexts/ToastContext";
import {
  DetailDrawer,
  DrawerField,
  DrawerSection,
  ExportButton,
  type ExportColumn,
} from "@/components/workspace";
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
  fmtDateTime,
  fmtHours,
  fmtMinutes,
  isOrderActive,
  mtbfByAsset,
} from "./maintenance.utils";
import type {
  Asset,
  AssetCriticality,
  AssetStatus,
  CreateAssetInput,
  CreateOrderInput,
  MaintenanceOrder,
} from "./maintenance.types";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000").replace(/\/$/, "");

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
  const [detail, setDetail] = useState<Asset | null>(null);

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

  // Exportación del registro de activos (respeta los filtros vía `rows`). Incluye
  // las órdenes vivas derivadas para que el CSV sirva como inventario accionable.
  const assetColumns = useMemo<ExportColumn<Asset>[]>(
    () => [
      { key: "code", header: "Código", value: (a) => a.code ?? "" },
      { key: "name", header: "Nombre" },
      { key: "category", header: "Categoría", value: (a) => a.category ?? "" },
      { key: "location", header: "Ubicación", value: (a) => a.location ?? "" },
      { key: "criticality", header: "Criticidad", value: (a) => CRITICALITY_META[a.criticality].label },
      { key: "status", header: "Estado", value: (a) => ASSET_STATUS_META[a.status].label },
      { key: "manufacturer", header: "Fabricante", value: (a) => a.manufacturer ?? "" },
      { key: "model", header: "Modelo", value: (a) => a.model ?? "" },
      { key: "serialNumber", header: "No. de serie", value: (a) => a.serialNumber ?? "" },
      { key: "openOrders", header: "Órdenes abiertas", value: (a) => openByAsset.get(a.id) ?? 0 },
    ],
    [openByAsset],
  );

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
        <ExportButton<Asset> rows={rows} columns={assetColumns} filename="activos-mantenimiento" />
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
                  <button onClick={() => setDetail(a)} className="min-w-0 flex-1 text-left" title="Ver detalle e historial">
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
      {detail && (
        <AssetDetailDrawer
          asset={detail}
          orders={orders}
          onClose={() => setDetail(null)}
          onNewOrder={onNewOrder}
          onEdit={(a) => {
            setDetail(null);
            setEditing(a);
          }}
        />
      )}
    </div>
  );
}

// ── Detalle del activo (drawer): identidad + indicadores + historial de órdenes ─
// Reutiliza el DetailDrawer accesible del Workspace (Esc / foco atrapado / scroll
// bloqueado) en vez de rodar otro panel. El historial sale del listado de órdenes
// ya cargado (filtrado por activo), así que no hay round-trip extra.
function AssetDetailDrawer({
  asset,
  orders,
  onClose,
  onNewOrder,
  onEdit,
}: {
  asset: Asset;
  orders: MaintenanceOrder[];
  onClose: () => void;
  onNewOrder: (prefill?: Partial<CreateOrderInput>) => void;
  onEdit: (asset: Asset) => void;
}) {
  const history = useMemo(
    () =>
      orders
        .filter((o) => o.assetId === asset.id)
        .sort(
          (a, b) =>
            new Date(b.created_at ?? 0).getTime() -
            new Date(a.created_at ?? 0).getTime(),
        ),
    [orders, asset.id],
  );
  const openCount = history.filter((o) => isOrderActive(o.status)).length;
  const downtime = history.reduce((s, o) => s + (o.downtimeMinutes ?? 0), 0);
  // mtbfByAsset agrupa sólo correctivas → con un único activo devuelve 0/1 fila.
  const mtbf = mtbfByAsset(history)[0];
  const failures = mtbf?.failures ?? 0;
  const down = asset.status === "DOWN";

  return (
    <DetailDrawer
      open
      onClose={onClose}
      title={asset.name}
      subtitle={[asset.code, asset.category, asset.location].filter(Boolean).join(" · ") || undefined}
      icon={HardDrive}
      accent={CRITICALITY_META[asset.criticality].color}
      actions={
        <>
          <button
            onClick={() => onEdit(asset)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10"
          >
            <Pencil className="w-4 h-4" /> Editar activo
          </button>
          <button
            onClick={() => {
              onNewOrder({
                assetId: asset.id,
                type: down ? "CORRECTIVE" : "PREVENTIVE",
                priority: down ? "HIGH" : "MEDIUM",
                title: down ? `Avería: ${asset.name}` : "",
              });
              onClose();
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white"
            style={{ background: COLORS.violet }}
          >
            <Wrench className="w-4 h-4" /> Nueva orden
          </button>
        </>
      }
    >
      <DrawerSection title="Equipo">
        <DrawerField label="Estado"><AssetStatusPill status={asset.status} /></DrawerField>
        <DrawerField label="Criticidad"><CriticalityPill criticality={asset.criticality} /></DrawerField>
        {asset.code && <DrawerField label="Código">{asset.code}</DrawerField>}
        {asset.category && <DrawerField label="Categoría">{asset.category}</DrawerField>}
        {asset.location && <DrawerField label="Ubicación">{asset.location}</DrawerField>}
        {(asset.manufacturer || asset.model) && (
          <DrawerField label="Equipo">{[asset.manufacturer, asset.model].filter(Boolean).join(" ")}</DrawerField>
        )}
        {asset.serialNumber && <DrawerField label="No. de serie">{asset.serialNumber}</DrawerField>}
      </DrawerSection>

      <DrawerSection title="Indicadores">
        <div className="grid grid-cols-2 gap-2">
          <MiniStat label="Órdenes" value={history.length} />
          <MiniStat label="Abiertas" value={openCount} color={openCount > 0 ? COLORS.amber : undefined} />
          <MiniStat
            label="Fallas"
            value={failures}
            sub={mtbf?.mtbfHours != null ? `MTBF ${fmtHours(mtbf.mtbfHours)}` : undefined}
          />
          <MiniStat label="Paro total" value={fmtMinutes(downtime)} />
        </div>
      </DrawerSection>

      <DrawerSection title={`Historial de órdenes${history.length ? ` (${history.length})` : ""}`}>
        {history.length === 0 ? (
          <div className="flex flex-col items-center text-center py-6 px-4">
            <div className="p-3 rounded-2xl bg-gray-100 dark:bg-white/5 text-gray-400 mb-3">
              <ClipboardList className="w-6 h-6" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
              Sin órdenes para este activo todavía. Crea la primera (preventiva o
              correctiva) para empezar su historial y medir MTBF/MTTR por equipo.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((o) => (
              <AssetOrderRow key={o.id} order={o} />
            ))}
          </div>
        )}
      </DrawerSection>
    </DetailDrawer>
  );
}

function MiniStat({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: number | string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.04] px-3 py-2">
      <div className="text-[11px] text-gray-400">{label}</div>
      <div className="text-base font-semibold tabular-nums" style={color ? { color } : undefined}>{value}</div>
      {sub && <div className="text-[11px] text-gray-400 truncate">{sub}</div>}
    </div>
  );
}

function AssetOrderRow({ order }: { order: MaintenanceOrder }) {
  return (
    <div className="rounded-xl border border-black/5 dark:border-white/10 p-3">
      <div className="flex items-center gap-2 flex-wrap">
        {order.folio && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500">{order.folio}</span>
        )}
        <span className="font-medium text-sm truncate">{order.title}</span>
        <StatusPill status={order.status} />
      </div>
      <div className="mt-1 flex items-center gap-2 text-[12px] text-gray-400 flex-wrap">
        <TypePill type={order.type} />
        <span>{fmtDateTime(order.created_at)}</span>
        {order.downtimeMinutes > 0 && (
          <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{fmtMinutes(order.downtimeMinutes)} paro</span>
        )}
        {order.dueDate && order.status !== "COMPLETED" && order.status !== "CANCELLED" && (
          <span>{dueLabel(order.dueDate)}</span>
        )}
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
