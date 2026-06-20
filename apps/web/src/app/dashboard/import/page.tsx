'use client';

import React, { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload, Loader2, CheckCircle2, AlertTriangle, FileUp, Database, Plug,
  ArrowRight, ArrowLeft, Package, Network, Workflow, X, Check,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { glass } from '@/lib/glass';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

type Target = 'MATERIAL' | 'BOM' | 'ROUTING';
type Source = 'CSV' | 'EXCEL' | 'SQL_STAGING' | 'IDOC_API';
type Step = 'setup' | 'map' | 'preview' | 'done';

interface FieldSpec { field: string; label: string; required: boolean; type: string; enumValues?: string[]; }
interface ValidatedRow { rowIndex: number; data: Record<string, unknown>; errors: { field: string; message: string }[]; valid: boolean; }
interface Preview { target: Target; fields: FieldSpec[]; summary: { total: number; valid: number; errors: number }; rows: ValidatedRow[]; }
interface Report { target: Target; source: string; summary: { total: number; valid: number; errors: number }; result: { created: number; updated: number; skipped: number; rowErrors: { rowIndex: number; message: string }[] }; }

const TARGET_META: Record<Target, { label: string; icon: typeof Package; desc: string }> = {
  MATERIAL: { label: 'Maestro de Materiales', icon: Package, desc: 'Partes / SKU (mm_material)' },
  BOM: { label: 'BOM Multinivel', icon: Network, desc: 'Padre · componente · cantidad' },
  ROUTING: { label: 'Ruteo', icon: Workflow, desc: 'Ensamble · operación · tiempos' },
};

const field =
  'w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-lg py-2 px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30';

export default function ImportPage() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('setup');
  const [target, setTarget] = useState<Target>('MATERIAL');
  const [source, setSource] = useState<Source>('CSV');
  const [busy, setBusy] = useState(false);

  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [pasteText, setPasteText] = useState('');

  const [fields, setFields] = useState<FieldSpec[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Preview | null>(null);
  const [createMissing, setCreateMissing] = useState(false);
  const [report, setReport] = useState<Report | null>(null);

  function reset() {
    setStep('setup'); setFileName(''); setHeaders([]); setRows([]); setPasteText('');
    setFields([]); setMapping({}); setPreview(null); setReport(null);
  }

  function parseWorkbook(data: ArrayBuffer | string, type: 'array' | 'string') {
    const wb = XLSX.read(data, { type });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) return { rows: [], headers: [] as string[] };
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
    const headerRow = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 })[0] as string[] | undefined;
    const hdrs = headerRow?.map((h) => String(h)) ?? (json[0] ? Object.keys(json[0]) : []);
    return { rows: json, headers: hdrs.filter(Boolean) };
  }

  async function afterRows(parsed: { rows: Record<string, unknown>[]; headers: string[] }) {
    if (!parsed.rows.length) { toast.error('No se detectaron filas.', 'Importar'); return; }
    setRows(parsed.rows); setHeaders(parsed.headers);
    // Fetch field spec + suggested mapping.
    try {
      const [fRes, sRes] = await Promise.all([
        apiFetch(`${API_BASE}/import-data/fields/${target}`),
        apiFetch(`${API_BASE}/import-data/suggest`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target, headers: parsed.headers }),
        }),
      ]);
      const f = await fRes.json().catch(() => []);
      const m = await sRes.json().catch(() => ({}));
      setFields(Array.isArray(f) ? f : []);
      setMapping(m && typeof m === 'object' ? m : {});
      setStep('map');
    } catch {
      toast.error('No se pudo preparar el mapeo.', 'Importar');
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const parsed = parseWorkbook(buf, 'array');
      setFileName(file.name);
      await afterRows(parsed);
    } catch {
      toast.error('No se pudo leer el archivo.', 'Importar');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function onPaste() {
    if (!pasteText.trim()) { toast.error('Pega filas (CSV/TSV).', 'Importar'); return; }
    setBusy(true);
    try {
      const parsed = parseWorkbook(pasteText, 'string');
      setFileName('(pegado)');
      await afterRows(parsed);
    } catch {
      toast.error('No se pudo parsear el texto.', 'Importar');
    } finally { setBusy(false); }
  }

  const requiredUnmapped = useMemo(
    () => fields.filter((f) => f.required && !mapping[f.field]).map((f) => f.label),
    [fields, mapping],
  );

  async function runPreview() {
    if (requiredUnmapped.length) { toast.error(`Mapea: ${requiredUnmapped.join(', ')}.`, 'Importar'); return; }
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/import-data/preview`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, target, rows, mapping }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d) { toast.error(d?.message || 'No se pudo previsualizar.', 'Importar'); return; }
      setPreview(d); setStep('preview');
    } catch { toast.error('Error de red.', 'Importar'); } finally { setBusy(false); }
  }

  async function runCommit() {
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/import-data/commit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, target, rows, mapping, createMissingMaterials: createMissing }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d) { toast.error(d?.message || 'No se pudo importar.', 'Importar'); return; }
      setReport(d); setStep('done');
      toast.success(`Importación: ${d.result.created} creados, ${d.result.updated} actualizados.`, 'Importar');
    } catch { toast.error('Error de red.', 'Importar'); } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen text-black dark:text-white font-sans pb-28">
      <main className="max-w-4xl mx-auto px-6 pt-10">
        <PageHeader domain="erp" title="Importar Datos · Migración" icon={Upload}
          subtitle="Trae Material Master, BOM y Routing desde CSV/Excel, staging SQL o un feed IDoc/API. Subir → mapear → previsualizar → confirmar." />

        <Stepper step={step} />

        {step === 'setup' && (
          <SetupStep
            target={target} setTarget={setTarget} source={source} setSource={setSource}
            busy={busy} fileRef={fileRef} onFile={onFile} pasteText={pasteText} setPasteText={setPasteText} onPaste={onPaste}
          />
        )}

        {step === 'map' && (
          <div className="space-y-4">
            <div className={`${glass} rounded-2xl p-4 flex items-center gap-3 text-sm`}>
              <FileUp className="w-4 h-4 text-violet-500" />
              <span className="font-medium">{fileName}</span>
              <span className="text-gray-400">{rows.length} filas · {headers.length} columnas</span>
              <span className="ml-auto text-gray-400">{TARGET_META[target].label}</span>
            </div>
            <div className={`${glass} rounded-2xl p-5`}>
              <h3 className="font-semibold mb-3">Mapeo de columnas</h3>
              <div className="space-y-2">
                {fields.map((f) => (
                  <div key={f.field} className="grid grid-cols-2 gap-3 items-center">
                    <div className="text-sm">
                      {f.label} {f.required && <span className="text-rose-500">*</span>}
                      {f.enumValues && <span className="block text-[11px] text-gray-400">{f.enumValues.join(' · ')}</span>}
                    </div>
                    <select className={field} value={mapping[f.field] ?? ''} onChange={(e) => setMapping({ ...mapping, [f.field]: e.target.value })}>
                      <option value="">— sin mapear —</option>
                      {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              {requiredUnmapped.length > 0 && (
                <div className="mt-3 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Falta mapear: {requiredUnmapped.join(', ')}</div>
              )}
            </div>
            <div className="flex justify-between">
              <button onClick={reset} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10"><ArrowLeft className="w-4 h-4" /> Volver</button>
              <button onClick={runPreview} disabled={busy || requiredUnmapped.length > 0} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white dark:text-black bg-black dark:bg-white disabled:opacity-50">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />} Previsualizar
              </button>
            </div>
          </div>
        )}

        {step === 'preview' && preview && (
          <PreviewStep
            preview={preview} target={target} createMissing={createMissing} setCreateMissing={setCreateMissing}
            busy={busy} onBack={() => setStep('map')} onCommit={runCommit}
          />
        )}

        {step === 'done' && report && (
          <DoneStep report={report} onReset={reset} />
        )}
      </main>
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'setup', label: 'Origen' }, { key: 'map', label: 'Mapear' },
    { key: 'preview', label: 'Previsualizar' }, { key: 'done', label: 'Confirmar' },
  ];
  const idx = steps.findIndex((s) => s.key === step);
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((s, i) => (
        <React.Fragment key={s.key}>
          <div className={`flex items-center gap-2 text-sm ${i <= idx ? 'text-black dark:text-white font-medium' : 'text-gray-400'}`}>
            <span className={`w-6 h-6 rounded-full grid place-items-center text-xs ${i < idx ? 'bg-emerald-500 text-white' : i === idx ? 'bg-violet-500 text-white' : 'bg-gray-100 dark:bg-white/10'}`}>
              {i < idx ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </span>
            {s.label}
          </div>
          {i < steps.length - 1 && <div className="flex-1 h-px bg-gray-100 dark:bg-white/10" />}
        </React.Fragment>
      ))}
    </div>
  );
}

function SetupStep({ target, setTarget, source, setSource, busy, fileRef, onFile, pasteText, setPasteText, onPaste }: {
  target: Target; setTarget: (t: Target) => void; source: Source; setSource: (s: Source) => void;
  busy: boolean; fileRef: React.RefObject<HTMLInputElement | null>;
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void; pasteText: string; setPasteText: (s: string) => void; onPaste: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className={`${glass} rounded-2xl p-5`}>
        <h3 className="font-semibold mb-3">¿Qué quieres importar?</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(Object.keys(TARGET_META) as Target[]).map((t) => {
            const m = TARGET_META[t]; const Icon = m.icon; const active = target === t;
            return (
              <button key={t} onClick={() => setTarget(t)} className={`rounded-xl p-4 text-left border transition-all ${active ? 'border-violet-500 ring-2 ring-violet-500/20' : 'border-gray-100 dark:border-white/10 hover:border-gray-200'}`}>
                <Icon className={`w-5 h-5 mb-2 ${active ? 'text-violet-500' : 'text-gray-400'}`} />
                <div className="font-semibold text-sm">{m.label}</div>
                <div className="text-[11px] text-gray-400">{m.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className={`${glass} rounded-2xl p-5`}>
        <h3 className="font-semibold mb-3">Origen de datos</h3>
        <div className="flex flex-wrap gap-2 mb-4">
          {([['CSV', 'CSV', FileUp], ['EXCEL', 'Excel', FileUp], ['SQL_STAGING', 'Staging SQL', Database], ['IDOC_API', 'IDoc / API', Plug]] as [Source, string, typeof FileUp][]).map(([s, label, Icon]) => (
            <button key={s} onClick={() => setSource(s)} className={`inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm border ${source === s ? 'border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-300' : 'border-gray-200 dark:border-white/10'}`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {(source === 'CSV' || source === 'EXCEL') && (
          <div>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.tsv,text/csv" onChange={onFile} className="hidden" />
            <button onClick={() => fileRef.current?.click()} disabled={busy} className="inline-flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold border-2 border-dashed border-gray-200 dark:border-white/15 hover:border-violet-400 w-full justify-center">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Subir archivo {source === 'EXCEL' ? '.xlsx' : '.csv'}
            </button>
            <p className="text-[11px] text-gray-400 mt-2">La primera fila debe ser el encabezado. Se lee la primera hoja.</p>
          </div>
        )}

        {source === 'SQL_STAGING' && (
          <div>
            <p className="text-[11px] text-gray-400 mb-2">Pega filas de tu tabla de staging (CSV/TSV con encabezado). Una integración SQL puede POSTear estas filas directo al API.</p>
            <textarea className={field} rows={6} value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder={'partNumber,description,itemType\nRES-1,Resistor 10k,PURCHASED'} />
            <div className="flex justify-end mt-2">
              <button onClick={onPaste} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white dark:text-black bg-black dark:bg-white disabled:opacity-60">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />} Continuar
              </button>
            </div>
          </div>
        )}

        {source === 'IDOC_API' && (
          <div className="rounded-xl p-4 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-sm flex items-start gap-2">
            <Plug className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <b>Gancho listo, conexión real es follow-up.</b> El adaptador de feed externo (SAP IDoc MATMAS/BOMMAT/ROUTING u OData/REST) está definido en el backend; cuando se configure, sus filas pasan por el mismo flujo mapear → previsualizar → confirmar. Por ahora usa CSV/Excel o staging SQL.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewStep({ preview, target, createMissing, setCreateMissing, busy, onBack, onCommit }: {
  preview: Preview; target: Target; createMissing: boolean; setCreateMissing: (b: boolean) => void;
  busy: boolean; onBack: () => void; onCommit: () => void;
}) {
  const cols = preview.fields.map((f) => f.field);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Filas" value={preview.summary.total} color="#5b5bd6" />
        <Kpi label="Válidas" value={preview.summary.valid} color="#10b981" />
        <Kpi label="Con error" value={preview.summary.errors} color="#f43f5e" />
      </div>

      {(target === 'BOM' || target === 'ROUTING') && (
        <label className={`${glass} rounded-2xl p-3 flex items-center gap-2 text-sm cursor-pointer`}>
          <input type="checkbox" checked={createMissing} onChange={(e) => setCreateMissing(e.target.checked)} />
          Crear materiales faltantes como stub (DRAFT) si no existen en el maestro
        </label>
      )}

      <div className={`${glass} rounded-2xl overflow-hidden`}>
        <div className="overflow-x-auto max-h-[420px]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white/90 dark:bg-black/80 backdrop-blur">
              <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400">
                <th className="px-3 py-2">#</th>
                {cols.map((c) => <th key={c} className="px-3 py-2 whitespace-nowrap">{c}</th>)}
                <th className="px-3 py-2">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/10">
              {preview.rows.map((r) => (
                <tr key={r.rowIndex} className={r.valid ? '' : 'bg-rose-500/5'}>
                  <td className="px-3 py-2 text-gray-400 tabular-nums">{r.rowIndex + 1}</td>
                  {cols.map((c) => <td key={c} className="px-3 py-2 whitespace-nowrap">{String(r.data[c] ?? '')}</td>)}
                  <td className="px-3 py-2">
                    {r.valid
                      ? <span className="inline-flex items-center gap-1 text-emerald-500 text-xs"><Check className="w-3.5 h-3.5" /> OK</span>
                      : <span className="inline-flex items-center gap-1 text-rose-500 text-xs" title={r.errors.map((e) => e.message).join(' ')}><X className="w-3.5 h-3.5" /> {r.errors.length} error(es)</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {preview.summary.errors > 0 && (
        <p className="text-xs text-gray-400">Las filas con error NO se importan; el resto sí. Corrige el origen y reimporta para completarlas.</p>
      )}

      <div className="flex justify-between">
        <button onClick={onBack} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10"><ArrowLeft className="w-4 h-4" /> Ajustar mapeo</button>
        <button onClick={onCommit} disabled={busy || preview.summary.valid === 0} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white dark:text-black bg-black dark:bg-white disabled:opacity-50">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Importar {preview.summary.valid} válidas
        </button>
      </div>
    </div>
  );
}

function DoneStep({ report, onReset }: { report: Report; onReset: () => void }) {
  const r = report.result;
  return (
    <div className="space-y-4">
      <div className={`${glass} rounded-2xl p-6 text-center`}>
        <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-500" />
        <h3 className="text-lg font-semibold">Importación completada</h3>
        <p className="text-sm text-gray-400">{TARGET_META[report.target].label} · {report.source}</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi label="Creados" value={r.created} color="#10b981" />
        <Kpi label="Actualizados" value={r.updated} color="#0a84ff" />
        <Kpi label="Omitidos" value={r.skipped} color="#9ca3af" />
        <Kpi label="Errores" value={r.rowErrors.length} color="#f43f5e" />
      </div>
      {r.rowErrors.length > 0 && (
        <div className={`${glass} rounded-2xl overflow-hidden`}>
          <div className="px-4 py-2 text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100 dark:border-white/10">Errores por fila</div>
          <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 dark:divide-white/10">
            {r.rowErrors.map((e, i) => (
              <div key={i} className="flex items-start gap-2 px-4 py-2 text-sm">
                <span className="text-gray-400 tabular-nums shrink-0">fila {e.rowIndex + 1}</span>
                <span className="text-rose-500">{e.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex justify-end">
        <button onClick={onReset} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white dark:text-black bg-black dark:bg-white">
          <Upload className="w-4 h-4" /> Nueva importación
        </button>
      </div>
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className={`${glass} rounded-2xl p-4`}>
      <div className="text-[11px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-2xl font-semibold mt-1 tabular-nums" style={{ color }}>{value}</div>
    </div>
  );
}
