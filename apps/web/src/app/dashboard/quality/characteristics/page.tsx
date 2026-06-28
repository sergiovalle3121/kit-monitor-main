"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Lock,
  Crosshair,
  Plus,
  Pencil,
  Trash2,
  ArrowUpDown,
  Ruler,
  Search,
} from "lucide-react";
import { glass } from "@/lib/glass";
import { useApi } from "@/hooks/useApi";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/contexts/ToastContext";
import { usePermissions } from "@/hooks/usePermissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { ExportButton, type ExportColumn } from "@/components/workspace";
import { Empty, Field, Kpi, Modal } from "../quality.ui";
import type {
  CharacteristicType,
  ModelOption,
  QualityCharacteristic,
} from "../quality.types";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000").replace(/\/$/, "");
const ACCENT = "#2ec27e";

const TYPE_META: Record<CharacteristicType, { label: string; color: string }> = {
  VARIABLE: { label: "Variable", color: "#3b82f6" },
  ATTRIBUTE: { label: "Atributo", color: "#a855f7" },
};

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return String(n);
}

/** Client-side mirror of the backend rule: USL > nominal > LSL when present. */
function specError(type: CharacteristicType, nominal?: number | null, usl?: number | null, lsl?: number | null): string | null {
  if (type === "ATTRIBUTE") return null;
  const N = nominal ?? null, U = usl ?? null, L = lsl ?? null;
  if (U !== null && L !== null && !(U > L)) return "El USL debe ser mayor que el LSL.";
  if (U !== null && N !== null && !(U > N)) return "El USL debe ser mayor que el nominal.";
  if (N !== null && L !== null && !(N > L)) return "El nominal debe ser mayor que el LSL.";
  return null;
}

type SortKey = "code" | "name" | "model" | "type" | "nominal";

export default function CharacteristicsPage() {
  const { canWrite } = usePermissions();
  const { data, isLoading, forbidden, mutate } = useApi<QualityCharacteristic[]>("/quality/characteristics");
  const { data: modelsData } = useApi<ModelOption[]>("/product-models");

  const rows = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const models = useMemo(() => (Array.isArray(modelsData) ? modelsData : []), [modelsData]);
  const modelLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const mo of models) m.set(mo.id, `${mo.modelNumber} · ${mo.name}`);
    return m;
  }, [models]);

  const [q, setQ] = useState("");
  const [model, setModel] = useState("");
  const [type, setType] = useState<CharacteristicType | "">("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "code", dir: 1 });
  const [editing, setEditing] = useState<QualityCharacteristic | null>(null);
  const [creating, setCreating] = useState(false);

  const kpis = useMemo(() => ({
    total: rows.length,
    variable: rows.filter((r) => r.type === "VARIABLE").length,
    attribute: rows.filter((r) => r.type === "ATTRIBUTE").length,
    critical: rows.filter((r) => r.isCritical).length,
  }), [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = rows.filter((r) => {
      if (activeOnly && !r.active) return false;
      if (model && (r.modelId ?? "") !== model) return false;
      if (type && r.type !== type) return false;
      if (needle) {
        const hay = `${r.code} ${r.name} ${r.unit ?? ""} ${r.station ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    const val = (r: QualityCharacteristic): string | number => {
      switch (sort.key) {
        case "name": return r.name.toLowerCase();
        case "model": return (r.modelId ? modelLabel.get(r.modelId) ?? r.modelId : "").toLowerCase();
        case "type": return r.type;
        case "nominal": return r.nominal ?? Number.NEGATIVE_INFINITY;
        default: return r.code.toLowerCase();
      }
    };
    return out.sort((a, b) => {
      const va = val(a), vb = val(b);
      if (va < vb) return -1 * sort.dir;
      if (va > vb) return 1 * sort.dir;
      return 0;
    });
  }, [rows, q, model, type, activeOnly, sort, modelLabel]);

  const exportColumns: ExportColumn<QualityCharacteristic>[] = [
    { key: "code", header: "Código" },
    { key: "name", header: "Nombre" },
    { key: "model", header: "Modelo", value: (r) => (r.modelId ? modelLabel.get(r.modelId) ?? r.modelId : "") },
    { key: "type", header: "Tipo", value: (r) => TYPE_META[r.type]?.label ?? r.type },
    { key: "unit", header: "Unidad" },
    { key: "nominal", header: "Nominal" },
    { key: "lsl", header: "LSL" },
    { key: "usl", header: "USL" },
    { key: "isCritical", header: "Crítica", value: (r) => (r.isCritical ? "Sí" : "No") },
    { key: "active", header: "Activa", value: (r) => (r.active ? "Sí" : "No") },
    { key: "station", header: "Estación" },
  ];

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  }

  return (
    <div className="min-h-screen text-black dark:text-white font-sans pb-32">
      <main className="max-w-6xl mx-auto px-6 pt-10">
        <PageHeader
          domain="quality"
          title="Características CTQ"
          subtitle="Catálogo de características críticas (cimiento de datos para SPC)"
          right={
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard/quality/measurements"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-medium hover:bg-black/5 dark:hover:bg-white/10"
                title="Mediciones capturadas contra cada característica"
              >
                <Ruler className="w-4 h-4" /> Mediciones
              </Link>
              {canWrite && (
                <button onClick={() => setCreating(true)} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white" style={{ background: ACCENT }}>
                  <Plus className="w-4 h-4" /> Nueva característica
                </button>
              )}
            </div>
          }
        />

        {forbidden ? (
          <Empty icon={<Lock className="w-6 h-6" />} title="Sin acceso" body="Inicia sesión con permisos de calidad para definir características CTQ." />
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <Kpi label="Características" value={kpis.total} color="#6b7280" />
              <Kpi label="Variables" value={kpis.variable} color={TYPE_META.VARIABLE.color} />
              <Kpi label="Atributos" value={kpis.attribute} color={TYPE_META.ATTRIBUTE.color} />
              <Kpi label="Críticas" value={kpis.critical} color={ACCENT} />
            </div>

            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar código, nombre, unidad…" className={`${glass} w-full rounded-xl pl-9 pr-3 py-2 text-sm outline-none`} />
              </div>
              <select value={model} onChange={(e) => setModel(e.target.value)} className={`${glass} rounded-xl px-3 py-2 text-sm outline-none`}>
                <option value="">Todos los modelos</option>
                {models.map((m) => <option key={m.id} value={m.id}>{m.modelNumber} · {m.name}</option>)}
              </select>
              <select value={type} onChange={(e) => setType(e.target.value as CharacteristicType | "")} className={`${glass} rounded-xl px-3 py-2 text-sm outline-none`}>
                <option value="">Todo tipo</option>
                <option value="VARIABLE">Variable</option>
                <option value="ATTRIBUTE">Atributo</option>
              </select>
              <label className="inline-flex items-center gap-1.5 text-sm px-2">
                <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} /> Solo activas
              </label>
              <ExportButton<QualityCharacteristic> rows={filtered} columns={exportColumns} filename="caracteristicas-ctq" formats={["csv"]} />
            </div>

            {isLoading ? (
              <div className="flex justify-center py-16 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <Empty
                icon={<Crosshair className="w-6 h-6" />}
                title={rows.length === 0 ? "Sin características CTQ" : "Sin resultados"}
                body={rows.length === 0
                  ? "Define las características críticas (CTQ) de tu modelo para empezar a medir y, después, controlar el proceso."
                  : "Ninguna característica coincide con el filtro."}
                cta={rows.length === 0 && canWrite ? (
                  <button onClick={() => setCreating(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: ACCENT }}>
                    <Plus className="w-4 h-4" /> Definir característica
                  </button>
                ) : undefined}
              />
            ) : (
              <div className={`${glass} rounded-2xl overflow-hidden`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-black/5 dark:border-white/10">
                        <Th onClick={() => toggleSort("code")}>Código</Th>
                        <Th onClick={() => toggleSort("name")}>Nombre</Th>
                        <Th onClick={() => toggleSort("model")}>Modelo</Th>
                        <Th onClick={() => toggleSort("type")}>Tipo</Th>
                        <th className="px-3 py-2 text-right">LSL</th>
                        <Th onClick={() => toggleSort("nominal")} className="text-right">Nominal</Th>
                        <th className="px-3 py-2 text-right">USL</th>
                        <th className="px-3 py-2">Unidad</th>
                        {canWrite && <th className="px-3 py-2" />}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((r) => {
                        const tm = TYPE_META[r.type] ?? { label: r.type, color: "#6b7280" };
                        return (
                          <tr key={r.id} className={`border-b border-black/5 dark:border-white/5 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] ${!r.active ? "opacity-50" : ""}`}>
                            <td className="px-3 py-2 font-mono text-[12px] whitespace-nowrap">
                              {r.code}{r.isCritical && <span className="ml-1.5 text-[10px] font-bold" style={{ color: ACCENT }} title="Crítica">★</span>}
                            </td>
                            <td className="px-3 py-2 font-medium">{r.name}</td>
                            <td className="px-3 py-2 text-gray-500 truncate max-w-[200px]">{r.modelId ? modelLabel.get(r.modelId) ?? "—" : <span className="text-gray-400">General</span>}</td>
                            <td className="px-3 py-2"><span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: `${tm.color}1f`, color: tm.color }}>{tm.label}</span></td>
                            <td className="px-3 py-2 text-right font-mono text-[12px] text-gray-500">{fmt(r.lsl)}</td>
                            <td className="px-3 py-2 text-right font-mono text-[12px]">{fmt(r.nominal)}</td>
                            <td className="px-3 py-2 text-right font-mono text-[12px] text-gray-500">{fmt(r.usl)}</td>
                            <td className="px-3 py-2 text-gray-500">{r.unit ?? "—"}</td>
                            {canWrite && (
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-1 justify-end">
                                  <button onClick={() => setEditing(r)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10" title="Editar"><Pencil className="w-3.5 h-3.5" /></button>
                                  <DeleteButton id={r.id} name={r.name} onDone={() => mutate()} />
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <p className="text-[11px] text-gray-400 mt-4">
              Este catálogo es el cimiento de datos para SPC. Las cartas de control y Cpk/Ppk llegan en un PR posterior que consume estas mediciones.
            </p>
          </>
        )}

        {(creating || editing) && (
          <CharacteristicModal
            initial={editing}
            models={models}
            onClose={() => { setCreating(false); setEditing(null); }}
            onSaved={() => { setCreating(false); setEditing(null); mutate(); }}
          />
        )}
      </main>
    </div>
  );
}

function Th({ children, onClick, className = "" }: { children: React.ReactNode; onClick?: () => void; className?: string }) {
  return (
    <th className={`px-3 py-2 ${className}`}>
      {onClick ? (
        <button onClick={onClick} className="inline-flex items-center gap-1 hover:text-gray-600 dark:hover:text-gray-200">
          {children} <ArrowUpDown className="w-3 h-3 opacity-50" />
        </button>
      ) : children}
    </th>
  );
}

function DeleteButton({ id, name, onDone }: { id: string; name: string; onDone: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function del() {
    if (!window.confirm(`¿Eliminar la característica "${name}"? Las mediciones existentes se conservan.`)) return;
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/quality/characteristics/${id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d?.message || "No se pudo eliminar.", "CTQ"); return; }
      toast.success("Característica eliminada.", "CTQ");
      onDone();
    } catch { toast.error("Error de red.", "CTQ"); } finally { setBusy(false); }
  }
  return (
    <button onClick={del} disabled={busy} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500 disabled:opacity-50" title="Eliminar">
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
    </button>
  );
}

function CharacteristicModal({
  initial,
  models,
  onClose,
  onSaved,
}: {
  initial: QualityCharacteristic | null;
  models: ModelOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    code: initial?.code ?? "",
    name: initial?.name ?? "",
    modelId: initial?.modelId ?? "",
    type: (initial?.type ?? "VARIABLE") as CharacteristicType,
    unit: initial?.unit ?? "",
    nominal: initial?.nominal != null ? String(initial.nominal) : "",
    usl: initial?.usl != null ? String(initial.usl) : "",
    lsl: initial?.lsl != null ? String(initial.lsl) : "",
    station: initial?.station ?? "",
    isCritical: initial?.isCritical ?? true,
    active: initial?.active ?? true,
    notes: initial?.notes ?? "",
  });

  const numOrNull = (s: string): number | null => (s.trim() === "" ? null : Number(s));
  const liveError = specError(form.type, numOrNull(form.nominal), numOrNull(form.usl), numOrNull(form.lsl));

  async function submit() {
    if (!form.name.trim()) { toast.error("El nombre es obligatorio.", "CTQ"); return; }
    if (form.type === "VARIABLE") {
      for (const [k, v] of [["nominal", form.nominal], ["USL", form.usl], ["LSL", form.lsl]] as const) {
        if (v.trim() !== "" && Number.isNaN(Number(v))) { toast.error(`${k} debe ser numérico.`, "CTQ"); return; }
      }
      if (liveError) { toast.error(liveError, "CTQ"); return; }
    }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        type: form.type,
        modelId: form.modelId || null,
        station: form.station.trim() || null,
        isCritical: form.isCritical,
        active: form.active,
        notes: form.notes.trim() || null,
        unit: form.type === "ATTRIBUTE" ? null : (form.unit.trim() || null),
        nominal: form.type === "ATTRIBUTE" ? null : numOrNull(form.nominal),
        usl: form.type === "ATTRIBUTE" ? null : numOrNull(form.usl),
        lsl: form.type === "ATTRIBUTE" ? null : numOrNull(form.lsl),
        ...(form.code.trim() ? { code: form.code.trim() } : {}),
      };
      const url = initial ? `${API_BASE}/quality/characteristics/${initial.id}` : `${API_BASE}/quality/characteristics`;
      const res = await apiFetch(url, { method: initial ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d?.message || (res.status === 403 ? "Necesitas permiso QUALITY_WRITE." : "No se pudo guardar."), "CTQ"); return; }
      toast.success(initial ? "Característica actualizada." : "Característica creada.", "CTQ");
      onSaved();
    } catch { toast.error("Error de red.", "CTQ"); } finally { setBusy(false); }
  }

  const isAttr = form.type === "ATTRIBUTE";

  return (
    <Modal title={initial ? "Editar característica CTQ" : "Nueva característica CTQ"} icon={<Crosshair className="w-4 h-4" style={{ color: ACCENT }} />} onClose={onClose} accent={ACCENT} busy={busy} onSubmit={submit} submitLabel={initial ? "Guardar" : "Crear"}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Nombre *"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="q-input" placeholder="Altura del conector" /></Field>
        <Field label="Código (opcional, se asigna CTQ- si se omite)"><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="q-input" placeholder="CTQ-00001" /></Field>
        <Field label="Modelo"><select value={form.modelId} onChange={(e) => setForm({ ...form, modelId: e.target.value })} className="q-input"><option value="">General (sin modelo)</option>{models.map((m) => <option key={m.id} value={m.id}>{m.modelNumber} · {m.name}</option>)}</select></Field>
        <Field label="Tipo"><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as CharacteristicType })} className="q-input"><option value="VARIABLE">Variable (numérica)</option><option value="ATTRIBUTE">Atributo (pasa/no pasa)</option></select></Field>
        {!isAttr && <Field label="Unidad"><input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="q-input" placeholder="mm, V, g…" /></Field>}
        <Field label="Estación / operación"><input value={form.station} onChange={(e) => setForm({ ...form, station: e.target.value })} className="q-input" placeholder="Ensamble final" /></Field>
        {!isAttr && <>
          <Field label="LSL (límite inferior)"><input type="number" step="any" value={form.lsl} onChange={(e) => setForm({ ...form, lsl: e.target.value })} className="q-input" /></Field>
          <Field label="Nominal"><input type="number" step="any" value={form.nominal} onChange={(e) => setForm({ ...form, nominal: e.target.value })} className="q-input" /></Field>
          <Field label="USL (límite superior)"><input type="number" step="any" value={form.usl} onChange={(e) => setForm({ ...form, usl: e.target.value })} className="q-input" /></Field>
        </>}
        <Field label="Notas" full><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="q-input min-h-[52px] resize-y" /></Field>
      </div>
      <div className="flex items-center gap-5 mt-3 text-sm">
        <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.isCritical} onChange={(e) => setForm({ ...form, isCritical: e.target.checked })} /> Crítica (CTQ)</label>
        <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Activa</label>
      </div>
      {!isAttr && liveError && <p className="text-[12px] mt-3 font-medium" style={{ color: "#ef4444" }}>{liveError}</p>}
      {!isAttr && !liveError && <p className="text-[11px] text-gray-400 mt-3">Para variables, el orden válido es USL &gt; nominal &gt; LSL (los límites son opcionales).</p>}
    </Modal>
  );
}
