"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, Loader2, X, AlertCircle, Workflow, Package, Boxes,
  Image as ImageIcon, ExternalLink, Clock,
} from "lucide-react";
import { glass } from "@/lib/glass";
import { useApi } from "@/hooks/useApi";
import { apiFetch } from "@/lib/apiFetch";
import { PageHeader } from "@/components/ui/PageHeader";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000").replace(/\/$/, "");

interface StepMaterial { id: number; partNumber: string; description?: string | null; qtyPerUnit: number; unit: string }
interface Step { id: number; model: string; revision: string; sequence: number; name: string; stationType?: string | null; instructions?: string | null; visualAidId?: string | null; materials: StepMaterial[] }
interface ModelOption { id: string; modelNumber: string; name: string; status: string }
interface VisualAid { id: string; model: string; title: string; process?: string | null; revision?: string | null; pdfUrl: string; isActive?: boolean }

const STATION_TYPES = [
  { value: "smt", label: "SMT" },
  { value: "aoi", label: "AOI / Inspección" },
  { value: "assembly", label: "Ensamble" },
  { value: "test", label: "Prueba / Test" },
  { value: "packing", label: "Empaque" },
];

async function post(path: string, body: unknown) {
  const res = await apiFetch(`${API_BASE}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d?.message || "Error");
  return d;
}
async function patch(path: string, body: unknown) {
  const res = await apiFetch(`${API_BASE}${path}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d?.message || "Error");
  return d;
}
async function del(path: string) {
  const res = await apiFetch(`${API_BASE}${path}`, { method: "DELETE" });
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.message || "Error"); }
}

/**
 * Visual aids are served by an authenticated endpoint; open them by fetching the
 * blob with the JWT and navigating a tab to its object URL (same pattern as the
 * Visual Aids screen) so it works whether or not the file route is guarded.
 */
async function openAid(filename: string, onError: (m: string) => void) {
  if (!filename) { onError("Esta ayuda no tiene archivo."); return; }
  const win = window.open("", "_blank");
  try {
    const res = await apiFetch(`${API_BASE}/visual-aids/file/${encodeURIComponent(filename)}`);
    if (!res.ok) { win?.close(); onError("No se pudo abrir la ayuda visual."); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    if (win) win.location.href = url; else window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch { win?.close(); onError("Error de red al abrir la ayuda."); }
}

export default function EngineeringPage() {
  const [model, setModel] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const flash = (m: string) => { setErr(m); setTimeout(() => setErr(null), 3500); };

  const { data, isLoading, mutate } = useApi<Step[]>(active ? `/process/routes?model=${encodeURIComponent(active)}` : null);
  const steps = Array.isArray(data) ? data : [];

  // Visual aids tagged with this model — to attach one per step (backend supports visualAidId).
  const { data: aidsData } = useApi<VisualAid[]>(active ? `/visual-aids?model=${encodeURIComponent(active)}` : null);
  const aids = (Array.isArray(aidsData) ? aidsData : []).filter((a) => a.isActive !== false);

  // Models come from the canonical master (no more free-text model strings).
  const { data: modelsData } = useApi<ModelOption[]>("/product-models");
  const models = (Array.isArray(modelsData) ? modelsData : []).filter((m) => m.status !== "OBSOLETE");

  const [stepName, setStepName] = useState("");
  const [stepType, setStepType] = useState("assembly");
  const [adding, setAdding] = useState(false);
  async function addStep() {
    if (!stepName.trim()) return;
    try { await post("/process/steps", { model: active, name: stepName, stationType: stepType }); setStepName(""); setAdding(false); mutate(); }
    catch (e) { flash(e instanceof Error ? e.message : "Error"); }
  }

  return (
    <div className="min-h-screen text-black dark:text-white font-sans pb-32">
      <main className="max-w-3xl mx-auto px-6 pt-10">
        <PageHeader
          domain="engineering"
          title="Ingeniería"
          subtitle="Define la ruta de la línea: estaciones, materiales y cuántos por unidad"
          right={
            <Link href="/dashboard/models" className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10">
              <Boxes className="w-4 h-4" /> Modelos / NPI
            </Link>
          }
        />

        <div className={`${glass} flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2 rounded-2xl mb-2`}>
          <select
            value={model}
            onChange={(e) => { setModel(e.target.value); setActive(e.target.value || null); }}
            className="bg-transparent outline-none text-sm w-full px-3 py-1.5"
          >
            <option value="">Selecciona un modelo del maestro…</option>
            {models.map((m) => (
              <option key={m.id} value={m.modelNumber}>{m.modelNumber} · {m.name}{m.status === "DRAFT" ? " (borrador)" : ""}</option>
            ))}
          </select>
          <button onClick={() => model && setActive(model)} className="bg-black dark:bg-white text-white dark:text-black text-sm font-semibold px-4 py-2 rounded-xl hover:scale-[1.03] active:scale-95 transition-transform whitespace-nowrap">Cargar ruta</button>
        </div>
        <p className="text-[12px] text-gray-400 mb-6 px-1">¿No aparece tu modelo? <Link href="/dashboard/models" className="underline hover:text-gray-600 dark:hover:text-gray-200">Créalo en Modelos · NPI</Link>.</p>

        <AnimatePresence>
          {err && <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex gap-2 items-center p-3 rounded-2xl bg-red-50 dark:bg-red-500/10 text-red-600 text-sm mb-4"><AlertCircle className="w-4 h-4" /> {err}</motion.div>}
        </AnimatePresence>

        {!active ? (
          <Empty icon={<Workflow className="w-6 h-6" />} title="Carga un modelo" body="Escribe un modelo y carga su ruta para definir las estaciones de la línea." />
        ) : isLoading ? (
          <div className="flex justify-center py-16 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Ruta de {active} · {steps.length} estaciones</h2>
              <button onClick={() => setAdding((v) => !v)} className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full bg-black dark:bg-white text-white dark:text-black hover:scale-[1.03] active:scale-95 transition-transform">
                {adding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {adding ? "Cancelar" : "Estación"}
              </button>
            </div>

            <div className="flex items-start gap-1.5 text-[12px] text-gray-400 mb-3 px-1">
              <Clock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>El tiempo estándar por estación (para takt, balanceo y yamazumi) se captura en <Link href="/dashboard/line-engineering" className="underline hover:text-gray-600 dark:hover:text-gray-200">Disposición de líneas</Link>.</span>
            </div>

            <AnimatePresence>
              {adding && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className={`${glass} rounded-2xl p-4 mb-4 overflow-hidden flex flex-col sm:flex-row gap-3`}>
                  <input value={stepName} onChange={(e) => setStepName(e.target.value)} placeholder="Nombre de la estación (ej. Prueba ICT)" className="bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl py-2.5 px-3 text-sm flex-1 outline-none" />
                  <select value={stepType} onChange={(e) => setStepType(e.target.value)} className="bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl py-2.5 px-3 text-sm outline-none">
                    {STATION_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  <button onClick={addStep} className="bg-emerald-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-emerald-600 active:scale-95 transition-all">Agregar</button>
                </motion.div>
              )}
            </AnimatePresence>

            {steps.length === 0 ? (
              <Empty icon={<Workflow className="w-6 h-6" />} title="Ruta vacía" body="Agrega la primera estación de la línea para este modelo." />
            ) : (
              <div className="space-y-3">
                {steps.map((s) => <StepCard key={s.id} step={s} aids={aids} onChange={mutate} onError={flash} />)}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function StepCard({ step, aids, onChange, onError }: { step: Step; aids: VisualAid[]; onChange: () => void; onError: (m: string) => void }) {
  const [addMat, setAddMat] = useState(false);
  const [pn, setPn] = useState(""); const [qty, setQty] = useState(""); const [unit, setUnit] = useState("EA");
  const [savingAid, setSavingAid] = useState(false);
  const typeLabel = STATION_TYPES.find((t) => t.value === step.stationType)?.label;
  const aid = step.visualAidId ? aids.find((a) => a.id === step.visualAidId) ?? null : null;

  async function setAid(id: string) {
    setSavingAid(true);
    try { await patch(`/process/steps/${step.id}`, { visualAidId: id || null }); onChange(); }
    catch (e) { onError(e instanceof Error ? e.message : "Error"); }
    finally { setSavingAid(false); }
  }

  async function add() {
    if (!pn.trim() || !qty) { onError("Número de parte y cantidad obligatorios."); return; }
    try { await post(`/process/steps/${step.id}/materials`, { partNumber: pn, qtyPerUnit: Number(qty), unit }); setPn(""); setQty(""); setAddMat(false); onChange(); }
    catch (e) { onError(e instanceof Error ? e.message : "Error"); }
  }
  async function removeMat(id: number) {
    if (!window.confirm("¿Quitar este material de la estación?")) return;
    try { await del(`/process/materials/${id}`); onChange(); } catch (e) { onError(e instanceof Error ? e.message : "Error"); }
  }
  async function removeStep() {
    if (!window.confirm(`¿Borrar la estación "${step.name}" y sus materiales? Esta acción no se puede deshacer.`)) return;
    try { await del(`/process/steps/${step.id}`); onChange(); } catch (e) { onError(e instanceof Error ? e.message : "Error"); }
  }

  return (
    <div className={`${glass} rounded-2xl p-4`}>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 font-bold flex items-center justify-center text-sm flex-shrink-0">{step.sequence}</div>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold truncate">{step.name}</h3>
          {typeLabel && <p className="text-[11px] text-gray-400">{typeLabel}</p>}
        </div>
        <button onClick={() => setAddMat((v) => !v)} className="p-2 rounded-full text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors" title="Agregar material"><Package className="w-4 h-4" /></button>
        <button onClick={removeStep} className="p-2 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors" title="Borrar estación"><Trash2 className="w-4 h-4" /></button>
      </div>

      <div className="pl-11 mb-2 flex items-center gap-2 flex-wrap text-sm">
        <ImageIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
        {aid ? (
          <>
            <button onClick={() => openAid(aid.pdfUrl, onError)} className="font-medium text-indigo-600 dark:text-indigo-300 hover:underline inline-flex items-center gap-1">{aid.title}<ExternalLink className="w-3 h-3" /></button>
            <span className="text-gray-300 dark:text-gray-600">·</span>
            <button onClick={() => setAid("")} disabled={savingAid} className="text-xs text-gray-400 hover:text-red-500">Quitar</button>
          </>
        ) : step.visualAidId ? (
          <>
            <span className="text-gray-500">Ayuda visual adjunta (otro modelo/rev)</span>
            <button onClick={() => setAid("")} disabled={savingAid} className="text-xs text-gray-400 hover:text-red-500">Quitar</button>
          </>
        ) : aids.length > 0 ? (
          <select value="" onChange={(e) => e.target.value && setAid(e.target.value)} disabled={savingAid} className="bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-lg py-1.5 px-2 text-sm outline-none">
            <option value="">Adjuntar ayuda visual…</option>
            {aids.map((a) => <option key={a.id} value={a.id}>{a.title}{a.revision ? ` · rev ${a.revision}` : ""}</option>)}
          </select>
        ) : (
          <span className="text-xs text-gray-400">Sin ayudas para este modelo — <Link href="/dashboard/visual-aids" className="underline hover:text-gray-600 dark:hover:text-gray-200">súbelas</Link></span>
        )}
        {savingAid && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
      </div>

      <AnimatePresence>
        {addMat && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden flex gap-2 mb-2 pl-11">
            <input value={pn} onChange={(e) => setPn(e.target.value)} placeholder="Núm. parte" className="bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-lg py-2 px-2.5 text-sm flex-1 outline-none" />
            <input value={qty} onChange={(e) => setQty(e.target.value)} type="number" min={1} placeholder="Cant/unidad" className="bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-lg py-2 px-2.5 text-sm w-28 outline-none" />
            <input value={unit} onChange={(e) => setUnit(e.target.value)} className="bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-lg py-2 px-2.5 text-sm w-16 outline-none" />
            <button onClick={add} className="bg-emerald-500 text-white text-sm font-semibold px-3 rounded-lg hover:bg-emerald-600 active:scale-95 transition-all">OK</button>
          </motion.div>
        )}
      </AnimatePresence>

      {step.materials?.length > 0 && (
        <div className="pl-11 space-y-1">
          {step.materials.map((m) => (
            <div key={m.id} className="flex items-center justify-between text-sm px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-white/5">
              <span className="font-mono">{m.partNumber}{m.description ? <span className="text-gray-400 ml-2 text-xs">{m.description}</span> : null}</span>
              <span className="flex items-center gap-2">
                <span className="font-semibold tabular-nums">{m.qtyPerUnit} {m.unit}/u</span>
                <button onClick={() => removeMat(m.id)} className="text-gray-300 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Empty({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center text-center py-16 px-6">
      <div className="p-4 rounded-2xl bg-gray-100 dark:bg-white/5 text-gray-400 mb-4">{icon}</div>
      <h3 className="font-bold text-lg mb-1">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">{body}</p>
    </div>
  );
}
