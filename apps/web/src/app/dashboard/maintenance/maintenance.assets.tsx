"use client";

// Asset registry (CMMS equipment master): list with search/filters, create with
// the full CreateAssetDto, and edit limited to what PATCH /maintenance/assets/:id
// actually accepts (name, category, location, criticality, status). Identity
// fields (code, manufacturer, model, serial) are set at creation and shown
// read-only on edit — honest about the backend's update surface.
import React, { useMemo, useState } from "react";
import {
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
  CriticalityPill,
  Empty,
  Field,
  Modal,
  Pill,
} from "./maintenance.ui";
import { AssetStatusSelect } from "./maintenance.actions";
import {
  ASSET_STATUS_META,
  ASSET_STATUS_ORDER,
  COLORS,
  CRITICALITY_META,
  CRITICALITY_ORDER,
  isOrderActive,
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
                  <div className="min-w-0 flex-1">
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
                  </div>
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
