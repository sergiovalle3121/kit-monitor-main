"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Loader2,
  Lock,
  Inbox,
  Plus,
  PackageCheck,
  Truck,
  ArrowRight,
  Crosshair,
  X,
} from "lucide-react";
import { glass } from "@/lib/glass";
import { useApi } from "@/hooks/useApi";
import { apiFetch } from "@/lib/apiFetch";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Empty, Field, Kpi, Modal } from "../quality.ui";
import type {
  FinalInspection,
  IqcInspection,
  IqcResult,
  OqcBacklogRow,
  OqcResult,
  QualityCharacteristic,
} from "../quality.types";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000").replace(/\/$/, "");

const IQC_META: Record<IqcResult, { label: string; color: string }> = {
  pass: { label: "Pasa", color: "#10b981" },
  fail: { label: "Falla", color: "#ef4444" },
  conditional: { label: "Condicional", color: "#f59e0b" },
  pending: { label: "Pendiente", color: "#6b7280" },
};
const OQC_META: Record<OqcResult, { label: string; color: string }> = {
  PASS: { label: "Pasa", color: "#10b981" },
  FAIL: { label: "Falla", color: "#ef4444" },
  CONDITIONAL: { label: "Condicional", color: "#f59e0b" },
};

type Tab = "iqc" | "oqc";

export default function InspectionsPage() {
  const [tab, setTab] = useState<Tab>("iqc");

  return (
    <div className="min-h-screen text-foreground font-sans pb-32">
      <main className="max-w-5xl mx-auto px-6 pt-10">
        <Link href="/dashboard/quality" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 mb-4">
          <ChevronLeft className="w-4 h-4" /> Calidad · NCR
        </Link>
        <PageHeader
          domain="quality"
          title="Calidad · Inspecciones"
          subtitle="IQC de recibo y OQC de salida sobre el backend de calidad"
        />

        <div className="inline-flex rounded-xl bg-black/5 dark:bg-white/10 p-0.5 text-sm mb-6">
          <TabBtn active={tab === "iqc"} onClick={() => setTab("iqc")} icon={<PackageCheck className="w-4 h-4" />}>IQC · Recibo</TabBtn>
          <TabBtn active={tab === "oqc"} onClick={() => setTab("oqc")} icon={<Truck className="w-4 h-4" />}>OQC · Salida</TabBtn>
        </div>

        {tab === "iqc" ? <IqcPanel /> : <OqcPanel />}
      </main>
    </div>
  );
}

// ── IQC ───────────────────────────────────────────────────────────────────────
function IqcPanel() {
  const { user } = useAuth();
  const { data, isLoading, forbidden, mutate } = useApi<IqcInspection[]>("/quality/iqc");
  const rows = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const [result, setResult] = useState<IqcResult | "">("");
  const [showForm, setShowForm] = useState(false);

  const filtered = result ? rows.filter((r) => r.result === result) : rows;
  const k = useMemo(() => ({
    total: rows.length,
    pass: rows.filter((r) => r.result === "pass").length,
    fail: rows.filter((r) => r.result === "fail").length,
    conditional: rows.filter((r) => r.result === "conditional").length,
  }), [rows]);

  if (forbidden) return <ForbiddenCard />;

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Kpi label="Inspecciones" value={k.total} color="#6b7280" />
        <Kpi label="Pasa" value={k.pass} color={IQC_META.pass.color} />
        <Kpi label="Falla" value={k.fail} color={IQC_META.fail.color} />
        <Kpi label="Condicional" value={k.conditional} color={IQC_META.conditional.color} />
      </div>

      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <label className="inline-flex items-center gap-1.5 text-sm">
          <span className="text-[11px] font-medium text-gray-400">Resultado</span>
          <select value={result} onChange={(e) => setResult(e.target.value as IqcResult | "")} className="bg-transparent outline-none text-sm rounded-lg px-1.5 py-1 hover:bg-black/5 dark:hover:bg-white/10">
            <option value="">Todos</option>
            {(Object.keys(IQC_META) as IqcResult[]).map((r) => <option key={r} value={r}>{IQC_META[r].label}</option>)}
          </select>
        </label>
        <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "#2ec27e" }}>
          <Plus className="w-4 h-4" /> Registrar IQC
        </button>
      </div>

      <p className="text-[12px] text-gray-400 mb-4">PASS libera el stock <span className="font-mono">pending_iqc</span> del lote; FAIL dispara un hold de calidad automático (contención).</p>

      {isLoading ? (
        <div className="flex justify-center py-16 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Empty icon={<Inbox className="w-6 h-6" />} title={rows.length === 0 ? "Sin inspecciones IQC" : "Sin resultados"} body={rows.length === 0 ? "Registra la primera inspección de recibo para liberar o contener material entrante." : "Ninguna inspección coincide con el filtro."} cta={rows.length === 0 ? <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "#2ec27e" }}><Plus className="w-4 h-4" /> Registrar IQC</button> : undefined} />
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const m = IQC_META[r.result] ?? { label: r.result, color: "#6b7280" };
            return (
              <div key={r.id} className={`${glass} rounded-2xl p-4 flex items-center gap-3`}>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: m.color }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-[11px] font-mono text-gray-400">{r.inspectionNumber}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: `${m.color}1f`, color: m.color }}>{m.label}</span>
                  </div>
                  <h3 className="font-semibold truncate"><span className="font-mono">{r.partNumber}</span>{r.lotNumber ? <span className="text-gray-400 font-normal"> · lote {r.lotNumber}</span> : null}</h3>
                  <p className="text-[12px] text-gray-400 truncate">
                    {r.sampleSize != null ? `muestra ${r.sampleSize}` : ""}{r.defectsFound != null ? ` · ${r.defectsFound} defectos` : ""}{r.warehouseId ? ` · ${r.warehouseId}` : ""}{r.inspector ? ` · ${r.inspector}` : ""}
                  </p>
                </div>
                <span className="text-[11px] text-gray-400 shrink-0 hidden sm:block">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ""}</span>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <IqcModal inspector={user?.email || "QA"} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); mutate(); }} />
      )}
    </>
  );
}

function IqcModal({ inspector, onClose, onSaved }: { inspector: string; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ partNumber: "", lotNumber: "", result: "pass" as IqcResult, sampleSize: "", defectsFound: "", warehouseId: "", notes: "" });

  async function submit() {
    if (!form.partNumber.trim()) { toast.error("El número de parte es obligatorio.", "IQC"); return; }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        partNumber: form.partNumber.trim(),
        result: form.result,
        inspector,
        ...(form.lotNumber.trim() ? { lotNumber: form.lotNumber.trim() } : {}),
        ...(form.sampleSize !== "" ? { sampleSize: Number(form.sampleSize) } : {}),
        ...(form.defectsFound !== "" ? { defectsFound: Number(form.defectsFound) } : {}),
        ...(form.warehouseId.trim() ? { warehouseId: form.warehouseId.trim() } : {}),
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      };
      const res = await apiFetch(`${API_BASE}/quality/iqc`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d?.message || (res.status === 403 ? "Necesitas permiso QUALITY_WRITE." : "No se pudo registrar."), "IQC"); return; }
      const created = await res.json().catch(() => null);
      toast.success(`IQC registrada${created?.inspectionNumber ? ` · ${created.inspectionNumber}` : ""}.`, "IQC");
      onSaved();
    } catch { toast.error("Error de red.", "IQC"); } finally { setBusy(false); }
  }

  return (
    <Modal title="Registrar inspección IQC" icon={<PackageCheck className="w-4 h-4" style={{ color: "#2ec27e" }} />} onClose={onClose} accent="#2ec27e" busy={busy} onSubmit={submit} submitLabel="Registrar">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Número de parte *"><input value={form.partNumber} onChange={(e) => setForm({ ...form, partNumber: e.target.value })} className="q-input" placeholder="CAP-0402-100NF" /></Field>
        <Field label="Lote"><input value={form.lotNumber} onChange={(e) => setForm({ ...form, lotNumber: e.target.value })} className="q-input" /></Field>
        <Field label="Resultado"><select value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value as IqcResult })} className="q-input">{(Object.keys(IQC_META) as IqcResult[]).map((r) => <option key={r} value={r}>{IQC_META[r].label}</option>)}</select></Field>
        <Field label="Almacén"><input value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })} className="q-input" placeholder="WH-QC" /></Field>
        <Field label="Tamaño de muestra"><input type="number" min={0} value={form.sampleSize} onChange={(e) => setForm({ ...form, sampleSize: e.target.value })} className="q-input" /></Field>
        <Field label="Defectos encontrados"><input type="number" min={0} value={form.defectsFound} onChange={(e) => setForm({ ...form, defectsFound: e.target.value })} className="q-input" /></Field>
        <Field label="Notas" full><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="q-input min-h-[52px] resize-y" /></Field>
      </div>
      {form.result === "fail" && <p className="text-[11px] mt-3" style={{ color: "#ef4444" }}>FAIL pondrá el lote en hold de calidad automáticamente (contención).</p>}
    </Modal>
  );
}

// ── OQC ───────────────────────────────────────────────────────────────────────
function OqcPanel() {
  const { user } = useAuth();
  const { data: backlogData, isLoading: blLoading, forbidden, mutate: mutateBl } = useApi<OqcBacklogRow[]>("/quality/oqc/backlog");
  const { data: histData, mutate: mutateHist } = useApi<FinalInspection[]>("/quality/oqc/history");
  const backlog = Array.isArray(backlogData) ? backlogData : [];
  const history = Array.isArray(histData) ? histData : [];
  const [prefill, setPrefill] = useState<{ partNumber?: string; quantityInspected?: number } | null>(null);

  if (forbidden) return <ForbiddenCard />;

  return (
    <>
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <h3 className="font-semibold">Backlog OQC (pendiente de inspección de salida)</h3>
        <button onClick={() => setPrefill({})} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "#2ec27e" }}>
          <Plus className="w-4 h-4" /> Registrar OQC
        </button>
      </div>

      {blLoading ? (
        <div className="flex justify-center py-10 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : backlog.length === 0 ? (
        <div className={`${glass} rounded-2xl p-6 text-center text-sm text-gray-400 mb-8`}>Sin material en <span className="font-mono">pending_oqc</span>. El producto terminado pendiente de OQC aparecerá aquí.</div>
      ) : (
        <div className="space-y-2 mb-8">
          {backlog.map((p) => (
            <div key={p.id} className={`${glass} rounded-2xl p-4 flex items-center gap-3`}>
              <div className="min-w-0 flex-1">
                <h4 className="font-semibold truncate"><span className="font-mono">{p.partNumber}</span> <span className="text-gray-400 font-normal text-[13px]">· {p.onHand} u</span></h4>
                <p className="text-[12px] text-gray-400 truncate">{p.warehouseId} · {p.location}{p.lotNumber ? ` · lote ${p.lotNumber}` : ""}{p.serialNumber ? ` · SN ${p.serialNumber}` : ""}</p>
              </div>
              <button onClick={() => setPrefill({ partNumber: p.partNumber, quantityInspected: p.onHand })} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium shrink-0" style={{ background: "#2ec27e1f", color: "#2ec27e" }}>
                <ArrowRight className="w-3 h-3" /> Inspeccionar
              </button>
            </div>
          ))}
        </div>
      )}

      <h3 className="text-sm font-semibold mb-3">Historial OQC</h3>
      {history.length === 0 ? (
        <Empty icon={<Inbox className="w-6 h-6" />} title="Sin inspecciones de salida" body="Registra una inspección OQC para liberar, retener o cuarentenar el producto terminado." />
      ) : (
        <div className="space-y-2">
          {history.map((h) => {
            const m = OQC_META[h.result] ?? { label: h.result, color: "#6b7280" };
            return (
              <div key={h.id} className={`${glass} rounded-2xl p-4 flex items-center gap-3`}>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: m.color }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-[11px] font-mono text-gray-400">{h.workOrder}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: `${m.color}1f`, color: m.color }}>{m.label}</span>
                  </div>
                  <h4 className="font-semibold truncate"><span className="font-mono">{h.partNumber}</span></h4>
                  <p className="text-[12px] text-gray-400 truncate">{h.quantityInspected} insp · {h.quantityPassed} ok · {h.quantityFailed} ng{h.defectType ? ` · ${h.defectType}` : ""}{h.inspector ? ` · ${h.inspector}` : ""}</p>
                </div>
                <span className="text-[11px] text-gray-400 shrink-0 hidden sm:block">{h.createdAt ? new Date(h.createdAt).toLocaleDateString() : ""}</span>
              </div>
            );
          })}
        </div>
      )}

      {prefill && (
        <OqcModal inspector={user?.email || "QA"} prefill={prefill} onClose={() => setPrefill(null)} onSaved={() => { setPrefill(null); mutateBl(); mutateHist(); }} />
      )}
    </>
  );
}

function OqcModal({ inspector, prefill, onClose, onSaved }: { inspector: string; prefill: { partNumber?: string; quantityInspected?: number }; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    workOrder: "",
    partNumber: prefill.partNumber ?? "",
    quantityInspected: prefill.quantityInspected != null ? String(prefill.quantityInspected) : "",
    quantityFailed: "",
    result: "PASS" as OqcResult,
    defectType: "",
    defectDescription: "",
    notes: "",
  });

  const inspected = Number(form.quantityInspected) || 0;
  const failed = Number(form.quantityFailed) || 0;
  const passed = Math.max(0, inspected - failed);

  // ── Additive (optional): capture VARIABLE CTQ readings alongside the OQC.
  // This NEVER blocks or alters the existing final_inspections save: it only
  // adds quality_measurements (source FINAL_INSPECTION) after the OQC succeeds.
  const { data: charsData } = useApi<QualityCharacteristic[]>("/quality/characteristics?active=true");
  const variableChars = useMemo(
    () => (Array.isArray(charsData) ? charsData.filter((c) => c.type === "VARIABLE") : []),
    [charsData],
  );
  const [ctq, setCtq] = useState<{ characteristicId: string; value: string }[]>([]);
  const addCtqRow = () => setCtq((r) => [...r, { characteristicId: variableChars[0]?.id ?? "", value: "" }]);
  const updateCtqRow = (i: number, patch: Partial<{ characteristicId: string; value: string }>) =>
    setCtq((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const removeCtqRow = (i: number) => setCtq((r) => r.filter((_, idx) => idx !== i));

  async function postCtqMeasurements(reference: string) {
    const valid = ctq.filter((r) => r.characteristicId && r.value.trim() !== "" && Number.isFinite(Number(r.value)));
    if (valid.length === 0) return;
    const byChar = new Map<string, number[]>();
    for (const r of valid) {
      const arr = byChar.get(r.characteristicId) ?? [];
      arr.push(Number(r.value));
      byChar.set(r.characteristicId, arr);
    }
    try {
      for (const [characteristicId, values] of byChar) {
        await apiFetch(`${API_BASE}/quality/measurements`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            characteristicId,
            source: "FINAL_INSPECTION",
            reference,
            subgroupId: reference,
            subgroupLabel: reference,
            measuredBy: inspector,
            readings: values.map((value) => ({ value })),
          }),
        });
      }
    } catch {
      // Non-blocking: the OQC already saved. Surface softly, do not fail.
      toast.error("OQC guardada, pero no se registraron algunas mediciones CTQ.", "OQC");
    }
  }

  async function submit() {
    if (!form.workOrder.trim()) { toast.error("La orden de trabajo es obligatoria.", "OQC"); return; }
    if (!form.partNumber.trim()) { toast.error("El número de parte es obligatorio.", "OQC"); return; }
    if (inspected <= 0) { toast.error("Cantidad inspeccionada debe ser mayor a 0.", "OQC"); return; }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        workOrder: form.workOrder.trim(),
        partNumber: form.partNumber.trim(),
        quantityInspected: inspected,
        quantityPassed: passed,
        quantityFailed: failed,
        result: form.result,
        inspector,
        ...(form.defectType.trim() ? { defectType: form.defectType.trim() } : {}),
        ...(form.defectDescription.trim() ? { defectDescription: form.defectDescription.trim() } : {}),
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      };
      const res = await apiFetch(`${API_BASE}/quality/oqc/inspections`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d?.message || (res.status === 403 ? "Necesitas permiso QUALITY_WRITE." : "No se pudo registrar."), "OQC"); return; }
      // Additive CTQ capture — runs only after the OQC saved; never blocks it.
      await postCtqMeasurements(form.workOrder.trim());
      toast.success("OQC registrada.", "OQC");
      onSaved();
    } catch { toast.error("Error de red.", "OQC"); } finally { setBusy(false); }
  }

  return (
    <Modal title="Registrar inspección OQC" icon={<Truck className="w-4 h-4" style={{ color: "#2ec27e" }} />} onClose={onClose} accent="#2ec27e" busy={busy} onSubmit={submit} submitLabel="Registrar">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Orden de trabajo *"><input value={form.workOrder} onChange={(e) => setForm({ ...form, workOrder: e.target.value })} className="q-input" placeholder="WO-2024-0042" /></Field>
        <Field label="Número de parte *"><input value={form.partNumber} onChange={(e) => setForm({ ...form, partNumber: e.target.value })} className="q-input" /></Field>
        <Field label="Resultado"><select value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value as OqcResult })} className="q-input">{(Object.keys(OQC_META) as OqcResult[]).map((r) => <option key={r} value={r}>{OQC_META[r].label}</option>)}</select></Field>
        <Field label="Cantidad inspeccionada *"><input type="number" min={0} value={form.quantityInspected} onChange={(e) => setForm({ ...form, quantityInspected: e.target.value })} className="q-input" /></Field>
        <Field label="Cantidad NG (falla)"><input type="number" min={0} value={form.quantityFailed} onChange={(e) => setForm({ ...form, quantityFailed: e.target.value })} className="q-input" /></Field>
        <Field label="OK (calculado)"><input value={passed} readOnly className="q-input opacity-70" /></Field>
        {form.result !== "PASS" && <Field label="Tipo de defecto"><input value={form.defectType} onChange={(e) => setForm({ ...form, defectType: e.target.value })} className="q-input" /></Field>}
        <Field label="Notas" full><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="q-input min-h-[52px] resize-y" /></Field>
      </div>

      {variableChars.length > 0 && (
        <div className="mt-4 border-t border-black/5 dark:border-white/10 pt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-semibold flex items-center gap-1.5"><Crosshair className="w-3.5 h-3.5" style={{ color: "#2ec27e" }} /> Características CTQ medidas (opcional)</span>
            <button type="button" onClick={addCtqRow} className="text-[12px] inline-flex items-center gap-1 font-medium" style={{ color: "#2ec27e" }}>
              <Plus className="w-3.5 h-3.5" /> Agregar
            </button>
          </div>
          {ctq.length === 0 ? (
            <p className="text-[11px] text-gray-400">Opcional: captura el valor medido de las CTQ del modelo. Se guardan como mediciones (fuente: inspección final) ligadas a la WO — sin afectar el guardado de la inspección.</p>
          ) : (
            <div className="space-y-2">
              {ctq.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select value={row.characteristicId} onChange={(e) => updateCtqRow(i, { characteristicId: e.target.value })} className="q-input flex-1">
                    {variableChars.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}{c.unit ? ` (${c.unit})` : ""}</option>)}
                  </select>
                  <input type="number" step="any" value={row.value} onChange={(e) => updateCtqRow(i, { value: e.target.value })} className="q-input w-28" placeholder="valor" />
                  <button type="button" onClick={() => removeCtqRow(i)} aria-label="Quitar" className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500"><X className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="text-[11px] text-gray-400 mt-3">El resultado aplica al stock <span className="font-mono">pending_oqc</span> en WH-FG: PASS→disponible, FAIL→hold, CONDITIONAL→cuarentena.</p>
    </Modal>
  );
}

// ── Shared bits ───────────────────────────────────────────────────────────────
function TabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium transition ${active ? "bg-white dark:bg-white/15 shadow-sm" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-200"}`}>
      {icon} {children}
    </button>
  );
}

function ForbiddenCard() {
  return (
    <div className={`${glass} rounded-3xl p-10 text-center max-w-sm mx-auto`}>
      <Lock className="w-8 h-8 mx-auto mb-3 text-gray-400" />
      <h2 className="text-lg font-semibold">Sin acceso</h2>
      <p className="text-sm text-gray-400 mt-1">Inicia sesión con permisos de calidad para ver y registrar inspecciones.</p>
    </div>
  );
}

