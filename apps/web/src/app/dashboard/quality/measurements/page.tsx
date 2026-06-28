"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from "recharts";
import {
  Loader2, Lock, Ruler, Plus, Crosshair, Inbox, Gauge,
} from "lucide-react";
import { glass } from "@/lib/glass";
import { useApi } from "@/hooks/useApi";
import { apiFetch } from "@/lib/apiFetch";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { usePermissions } from "@/hooks/usePermissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { ExportButton, type ExportColumn } from "@/components/workspace";
import { Empty, Field, Kpi, Modal } from "../quality.ui";
import type {
  MeasurementSource,
  MeasurementSummary,
  QualityCharacteristic,
  QualityMeasurement,
} from "../quality.types";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000").replace(/\/$/, "");
const ACCENT = "#2ec27e";

const SOURCE_META: Record<MeasurementSource, string> = {
  MANUAL: "Manual",
  FINAL_INSPECTION: "Inspección final",
  STATION: "En estación",
};

function num(n: number | null | undefined, digits = 4): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return Number(n.toFixed(digits)).toString();
}

interface Bin { label: string; count: number; center: number }
function buildHistogram(values: number[], bins = 10): Bin[] {
  if (values.length === 0) return [];
  const min = Math.min(...values), max = Math.max(...values);
  if (min === max) return [{ label: num(min, 3), count: values.length, center: min }];
  const width = (max - min) / bins;
  const out: Bin[] = Array.from({ length: bins }, (_, i) => {
    const x0 = min + i * width;
    return { label: `${num(x0, 2)}`, count: 0, center: x0 + width / 2 };
  });
  for (const v of values) {
    let idx = Math.floor((v - min) / width);
    if (idx >= bins) idx = bins - 1;
    if (idx < 0) idx = 0;
    out[idx].count += 1;
  }
  return out;
}

export default function MeasurementsPage() {
  const { canWrite } = usePermissions();
  const { data: charsData, forbidden } = useApi<QualityCharacteristic[]>("/quality/characteristics");
  const chars = useMemo(() => (Array.isArray(charsData) ? charsData : []), [charsData]);

  const [selected, setSelected] = useState<string>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [capturing, setCapturing] = useState(false);

  // Default to the first characteristic once they load.
  useEffect(() => {
    if (!selected && chars.length) queueMicrotask(() => setSelected(chars[0].id));
  }, [chars, selected]);

  const char = chars.find((c) => c.id === selected) || null;
  const range = useMemo(() => {
    const p = new URLSearchParams();
    if (from) p.set("from", new Date(from).toISOString());
    if (to) p.set("to", new Date(to).toISOString());
    const s = p.toString();
    return s ? `&${s}` : "";
  }, [from, to]);

  const seriesPath = selected ? `/quality/measurements?characteristic=${selected}${range}` : null;
  const summaryPath = selected ? `/quality/measurements/summary?characteristic=${selected}${range}` : null;
  const { data: seriesData, isLoading, mutate: mutateSeries } = useApi<QualityMeasurement[]>(seriesPath);
  const { data: summary, mutate: mutateSummary } = useApi<MeasurementSummary>(summaryPath);
  const series = useMemo(() => (Array.isArray(seriesData) ? seriesData : []), [seriesData]);

  const histogram = useMemo(() => {
    if (!char || char.type !== "VARIABLE") return [];
    const values = series.map((s) => s.value).filter((v): v is number => typeof v === "number");
    return buildHistogram(values);
  }, [series, char]);

  const exportColumns: ExportColumn<QualityMeasurement>[] = [
    { key: "measuredAt", header: "Fecha", value: (m) => (m.measuredAt ? new Date(m.measuredAt).toISOString() : "") },
    { key: "value", header: "Valor", value: (m) => (m.value ?? "") },
    { key: "passed", header: "Pasa", value: (m) => (m.passed == null ? "" : m.passed ? "Sí" : "No") },
    { key: "subgroupLabel", header: "Subgrupo", value: (m) => m.subgroupLabel ?? m.subgroupId ?? "" },
    { key: "source", header: "Fuente", value: (m) => SOURCE_META[m.source] ?? m.source },
    { key: "reference", header: "Referencia" },
    { key: "measuredBy", header: "Medido por" },
  ];

  function refresh() { mutateSeries(); mutateSummary(); }

  return (
    <div className="min-h-screen text-black dark:text-white font-sans pb-32">
      <main className="max-w-6xl mx-auto px-6 pt-10">
        <PageHeader
          domain="quality"
          title="Mediciones CTQ"
          subtitle="Serie y resumen descriptivo por característica (datos que SPC consumirá)"
          right={
            <div className="flex items-center gap-2">
              <Link href="/dashboard/quality/characteristics" className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-medium hover:bg-black/5 dark:hover:bg-white/10" title="Catálogo de características CTQ">
                <Crosshair className="w-4 h-4" /> Características
              </Link>
              {canWrite && char && (
                <button onClick={() => setCapturing(true)} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white" style={{ background: ACCENT }}>
                  <Plus className="w-4 h-4" /> Capturar mediciones
                </button>
              )}
            </div>
          }
        />

        {forbidden ? (
          <Empty icon={<Lock className="w-6 h-6" />} title="Sin acceso" body="Inicia sesión con permisos de calidad para ver y capturar mediciones." />
        ) : chars.length === 0 ? (
          <Empty
            icon={<Crosshair className="w-6 h-6" />}
            title="Aún no hay características"
            body="Define las características críticas (CTQ) de tu modelo para empezar a medir y, después, controlar el proceso."
            cta={<Link href="/dashboard/quality/characteristics" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: ACCENT }}><Crosshair className="w-4 h-4" /> Ir a características</Link>}
          />
        ) : (
          <>
            <div className="flex items-center gap-2 mb-5 flex-wrap">
              <select value={selected} onChange={(e) => setSelected(e.target.value)} className={`${glass} rounded-xl px-3 py-2 text-sm outline-none min-w-[260px]`}>
                {chars.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}{c.unit ? ` (${c.unit})` : ""}</option>)}
              </select>
              <label className="inline-flex items-center gap-1.5 text-sm"><span className="text-[11px] text-gray-400">Desde</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`${glass} rounded-xl px-2.5 py-1.5 text-sm outline-none`} /></label>
              <label className="inline-flex items-center gap-1.5 text-sm"><span className="text-[11px] text-gray-400">Hasta</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`${glass} rounded-xl px-2.5 py-1.5 text-sm outline-none`} /></label>
              <div className="ml-auto"><ExportButton<QualityMeasurement> rows={series} columns={exportColumns} filename={`mediciones-${char?.code ?? "ctq"}`} formats={["csv"]} /></div>
            </div>

            {char && (
              <div className={`${glass} rounded-2xl p-4 mb-5 flex items-center gap-4 flex-wrap`}>
                <Gauge className="w-5 h-5 text-gray-400" />
                <div className="text-sm">
                  <span className="font-semibold">{char.name}</span>
                  <span className="text-gray-400"> · {char.type === "VARIABLE" ? "Variable" : "Atributo"}</span>
                </div>
                {char.type === "VARIABLE" && (
                  <div className="text-[12px] text-gray-500 flex items-center gap-3 font-mono">
                    <span>LSL {num(char.lsl, 3)}</span><span>Nominal {num(char.nominal, 3)}</span><span>USL {num(char.usl, 3)}</span>{char.unit ? <span className="text-gray-400">{char.unit}</span> : null}
                  </div>
                )}
              </div>
            )}

            {/* Descriptive summary — NO control limits / Cpk (that is the SPC PR). */}
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-5">
              <Kpi label="n" value={summary?.n ?? 0} color="#6b7280" />
              <Kpi label="Media" value={num(summary?.mean ?? null)} color="#3b82f6" />
              <Kpi label="σ (muestral)" value={num(summary?.std ?? null)} color="#8b5cf6" />
              <Kpi label="Mín" value={num(summary?.min ?? null)} color="#6b7280" />
              <Kpi label="Máx" value={num(summary?.max ?? null)} color="#6b7280" />
              <Kpi label="% fuera" value={summary ? `${num(summary.pctOutOfSpec, 1)}%` : "—"} color={(summary?.outOfSpec ?? 0) > 0 ? "#ef4444" : ACCENT} sub={summary ? `${summary.belowLsl}<LSL · ${summary.aboveUsl}>USL` : undefined} />
            </div>

            {isLoading ? (
              <div className="flex justify-center py-16 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : series.length === 0 ? (
              <Empty
                icon={<Inbox className="w-6 h-6" />}
                title="Sin mediciones"
                body={canWrite ? "Captura los valores medidos de esta característica (en lote o por subgrupo) para ver la serie y el resumen." : "Aún no hay mediciones capturadas para esta característica."}
                cta={canWrite && char ? <button onClick={() => setCapturing(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: ACCENT }}><Plus className="w-4 h-4" /> Capturar mediciones</button> : undefined}
              />
            ) : (
              <>
                {char?.type === "VARIABLE" && histogram.length > 0 && (
                  <div className={`${glass} rounded-2xl p-4 mb-5`}>
                    <h3 className="text-sm font-semibold mb-3">Histograma</h3>
                    <div className="h-56 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={histogram} margin={{ top: 8, right: 8, left: -12, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" vertical={false} />
                          <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="rgba(148,163,184,0.6)" interval={0} angle={-20} textAnchor="end" height={42} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="rgba(148,163,184,0.6)" />
                          <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid rgba(148,163,184,0.3)", fontSize: 12 }} />
                          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                            {histogram.map((b, i) => {
                              const out = (char.usl != null && b.center > char.usl) || (char.lsl != null && b.center < char.lsl);
                              return <Cell key={i} fill={out ? "#ef4444" : ACCENT} fillOpacity={0.85} />;
                            })}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-2">Barras rojas: bins fuera de los límites de especificación. (Sin cartas de control ni Cpk: eso llega en el PR de SPC.)</p>
                  </div>
                )}

                <div className={`${glass} rounded-2xl overflow-hidden`}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-black/5 dark:border-white/10">
                          <th className="px-3 py-2">Fecha</th>
                          <th className="px-3 py-2 text-right">{char?.type === "ATTRIBUTE" ? "Pasa" : "Valor"}</th>
                          <th className="px-3 py-2">Subgrupo</th>
                          <th className="px-3 py-2">Fuente</th>
                          <th className="px-3 py-2">Referencia</th>
                          <th className="px-3 py-2">Medido por</th>
                        </tr>
                      </thead>
                      <tbody>
                        {series.map((m) => {
                          const out = char?.type === "VARIABLE" && typeof m.value === "number" &&
                            ((char.usl != null && m.value > char.usl) || (char.lsl != null && m.value < char.lsl));
                          return (
                            <tr key={m.id} className="border-b border-black/5 dark:border-white/5 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                              <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{m.measuredAt ? new Date(m.measuredAt).toLocaleString() : "—"}</td>
                              <td className="px-3 py-2 text-right font-mono" style={out ? { color: "#ef4444", fontWeight: 600 } : undefined}>
                                {char?.type === "ATTRIBUTE" ? (m.passed == null ? "—" : m.passed ? "Sí" : "No") : num(m.value ?? null)}
                              </td>
                              <td className="px-3 py-2 text-gray-500">{m.subgroupLabel ?? m.subgroupId ?? "—"}</td>
                              <td className="px-3 py-2"><span className="text-[11px] text-gray-500">{SOURCE_META[m.source] ?? m.source}</span></td>
                              <td className="px-3 py-2 font-mono text-[12px] text-gray-500">{m.reference ?? "—"}</td>
                              <td className="px-3 py-2 text-gray-500 truncate max-w-[160px]">{m.measuredBy ?? "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {capturing && char && (
          <CaptureModal characteristic={char} onClose={() => setCapturing(false)} onSaved={() => { setCapturing(false); refresh(); }} />
        )}
      </main>
    </div>
  );
}

function CaptureModal({
  characteristic,
  onClose,
  onSaved,
}: {
  characteristic: QualityCharacteristic;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const isAttr = characteristic.type === "ATTRIBUTE";
  const [form, setForm] = useState({
    raw: "",
    subgroupLabel: "",
    reference: "",
    gage: "",
    source: "MANUAL" as MeasurementSource,
    notes: "",
  });

  function parseReadings(): { count: number; readings: Array<{ value?: number | null; passed?: boolean | null }> } {
    const tokens = form.raw.split(/[\s,;]+/).map((t) => t.trim()).filter(Boolean);
    if (isAttr) {
      const readings = tokens.map((t) => {
        const low = t.toLowerCase();
        const pass = ["p", "pass", "ok", "1", "true", "si", "sí"].includes(low);
        const fail = ["f", "fail", "ng", "0", "false", "no"].includes(low);
        return pass ? { passed: true } : fail ? { passed: false } : null;
      }).filter((r): r is { passed: boolean } => r !== null);
      return { count: readings.length, readings };
    }
    const readings = tokens.map((t) => Number(t)).filter((n) => Number.isFinite(n)).map((value) => ({ value }));
    return { count: readings.length, readings };
  }

  const preview = parseReadings();

  async function submit() {
    if (preview.count === 0) {
      toast.error(isAttr ? "Ingresa lecturas pasa/no-pasa (p/f)." : "Ingresa al menos un valor numérico.", "Mediciones");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        characteristicId: characteristic.id,
        source: form.source,
        reference: form.reference.trim() || null,
        gage: form.gage.trim() || null,
        subgroupLabel: form.subgroupLabel.trim() || null,
        subgroupId: form.subgroupLabel.trim() || null,
        measuredBy: user?.email || null,
        notes: form.notes.trim() || null,
        readings: preview.readings,
      };
      const res = await apiFetch(`${API_BASE}/quality/measurements`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d?.message || (res.status === 403 ? "Necesitas permiso QUALITY_WRITE." : "No se pudo guardar."), "Mediciones"); return; }
      toast.success(`${preview.count} medición(es) capturada(s).`, "Mediciones");
      onSaved();
    } catch { toast.error("Error de red.", "Mediciones"); } finally { setBusy(false); }
  }

  return (
    <Modal title={`Capturar · ${characteristic.code}`} icon={<Ruler className="w-4 h-4" style={{ color: ACCENT }} />} onClose={onClose} accent={ACCENT} busy={busy} onSubmit={submit} submitLabel={`Capturar (${preview.count})`}>
      <div className="grid grid-cols-2 gap-4">
        <Field label={isAttr ? "Lecturas pasa/no-pasa (p f p f …)" : `Valores ${characteristic.unit ? `en ${characteristic.unit}` : ""} (separa con espacio o coma)`} full>
          <textarea value={form.raw} onChange={(e) => setForm({ ...form, raw: e.target.value })} className="q-input min-h-[80px] resize-y font-mono" placeholder={isAttr ? "p p f p p" : "10.01 9.98 10.05 9.97 10.02"} />
        </Field>
        <Field label="Subgrupo / muestra"><input value={form.subgroupLabel} onChange={(e) => setForm({ ...form, subgroupLabel: e.target.value })} className="q-input" placeholder="Turno A · 10:00" /></Field>
        <Field label="Fuente"><select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value as MeasurementSource })} className="q-input"><option value="MANUAL">Manual</option><option value="FINAL_INSPECTION">Inspección final</option></select></Field>
        <Field label="Referencia (WO / serial / lote)"><input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className="q-input" placeholder="WO-2024-0042" /></Field>
        <Field label="Instrumento / gage"><input value={form.gage} onChange={(e) => setForm({ ...form, gage: e.target.value })} className="q-input" placeholder="CMM-01" /></Field>
        <Field label="Notas" full><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="q-input min-h-[44px] resize-y" /></Field>
      </div>
      <p className="text-[11px] text-gray-400 mt-3">Se registran {preview.count} lectura(s) en el mismo subgrupo. Las mediciones quedan listas para que el PR de SPC grafique las cartas de control.</p>
    </Modal>
  );
}
