'use client';

import React, { useId, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  ChevronLeft, Gauge, Plus, Lock, Loader2, Inbox, X, CheckCircle2,
  ListOrdered, Layers, Activity, AlertTriangle, Image as ImageIcon, Star,
  BarChart3, Pencil, Calculator, ChevronDown, Boxes,
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { glass } from '@/lib/glass';
import ErrorBoundary from '@/components/ErrorBoundary';
import { useApi } from '@/hooks/useApi';
import { useDialogA11y } from '@/hooks/useDialogA11y';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';

// The 2D layout editor stands on `fabric` (canvas), so it is browser-only —
// loaded with ssr:false, the same pattern the Office editors use.
const LayoutEditor = dynamic(
  () => import('@/components/line-engineering/LayoutEditor').then((m) => m.LayoutEditor),
  { ssr: false, loading: () => <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div> },
);
// The full-screen 3D CAD editor (three.js) — browser-only, loaded only when opened.
const Layout3DEditor = dynamic(
  () => import('@/components/line-engineering/Layout3DEditor'),
  { ssr: false },
);

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const ROSE = '#f43f5e';
const GREEN = '#10b981';
const AMBER = '#f59e0b';
const BLUE = '#3b82f6';
const VIOLET = '#7c3aed';

interface Station {
  id: string; model: string; revision: string; line: string; station: string;
  sequence: number; npExpected: string | null; useFactor: number; stdTimeSec: number;
  feederPosition: string | null; visualAidUrl: string | null; ctq: boolean; active: boolean;
}
interface Qual {
  id: string; model: string; revision: string; line: string;
  changeoverMinutes: number; taktTargetSec: number; active: boolean;
}
interface Balance {
  model: string; revision: string; taktSec: number; stationCount: number;
  lineCycleTimeSec: number; bottleneckStation: string | null; totalWorkSec: number;
  balancePct: number; stationsOverTakt: string[]; throughputPerHour: number;
  theoreticalMinStations: number;
  completeness: { total: number; withVisualAid: number; completenessPct: number; incompleteStations: number; ctqCount: number };
}
interface Kpis {
  stationsTotal: number; stationsWithVisualAid: number; pctVisualAid: number;
  modelsQualified: number; modelsBalanced: number; pctModelsBalanced: number;
  ctqStations: number; incompleteLayouts: number;
}
interface ModelOption { id: string; modelNumber: string; name: string; status: string }
interface VisualAid { id: string; model: string; title: string; revision?: string | null; pdfUrl: string; isActive?: boolean }
interface Capacity { line: string; model: string; requiredMinutes: number; changeoverMinutes: number; availableMinutes: number; utilizationPct: number; feasible: boolean }

const pct = (n: number) => `${Math.round((n || 0) * 100)}%`;

export default function LineEngineeringPage() {
  const toast = useToast();
  const { data: kpis } = useApi<Kpis>('/line-engineering/kpis');
  const { data: stationsData, isLoading, forbidden, mutate } = useApi<Station[]>('/line-engineering/stations');
  const { data: qualsData, mutate: mutateQuals } = useApi<Qual[]>('/line-engineering/qualifications');
  // Models come from the canonical master (NPI), not free text.
  const { data: pmData } = useApi<ModelOption[]>('/product-models');
  const masterModels = (Array.isArray(pmData) ? pmData : []).filter((m) => m.status !== 'OBSOLETE');

  const stations = useMemo(() => (Array.isArray(stationsData) ? stationsData : []), [stationsData]);
  const quals = useMemo(() => (Array.isArray(qualsData) ? qualsData : []), [qualsData]);

  const models = useMemo(() => {
    const set = new Map<string, { model: string; revision: string }>();
    stations.forEach((s) => set.set(`${s.model}|${s.revision}`, { model: s.model, revision: s.revision }));
    return Array.from(set.values());
  }, [stations]);

  const [selModel, setSelModel] = useState<string>('');
  const [view, setView] = useState<'balance' | 'layout' | 'cad3d'>('balance');
  const activeModel = selModel || (models[0] ? `${models[0].model}|${models[0].revision}` : '');
  const [model, revision] = activeModel ? activeModel.split('|') : ['', 'A'];

  // Takt for balancing: prefer an explicit override, else the model's qualification
  // (model+revision first, then any qualification of the model with a takt target).
  const qualTakt =
    quals.find((q) => q.model === model && q.revision === revision && q.taktTargetSec > 0)?.taktTargetSec ??
    quals.find((q) => q.model === model && q.taktTargetSec > 0)?.taktTargetSec ??
    0;
  const [taktOverride, setTaktOverride] = useState<string>('');
  const effTakt = taktOverride.trim() !== '' ? Math.max(0, Number(taktOverride) || 0) : qualTakt;

  const { data: balance, mutate: mutateBalance } = useApi<Balance>(
    model ? `/line-engineering/balance?model=${encodeURIComponent(model)}&revision=${revision}${effTakt > 0 ? `&taktTargetSec=${effTakt}` : ''}` : null,
  );

  const route = stations
    .filter((s) => s.model === model && s.revision === revision)
    .sort((a, b) => a.sequence - b.sequence);

  const lines = useMemo(
    () => Array.from(new Set([...stations.map((s) => s.line), ...quals.map((q) => q.line)].filter(Boolean))).sort(),
    [stations, quals],
  );

  const [showStation, setShowStation] = useState(false);
  const [showQual, setShowQual] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sf, setSf] = useState({ model: '', revision: 'A', line: 'SMT-1', station: '', sequence: 10, npExpected: '', useFactor: 1, stdTimeSec: 30, visualAidUrl: '', ctq: false });
  const [qf, setQf] = useState({ model: '', revision: 'A', line: 'SMT-1', changeoverMinutes: 20, taktTargetSec: 60 });

  // Visual aids of the station's model — to pick one instead of pasting a URL.
  const { data: modalAidsData } = useApi<VisualAid[]>(showStation && sf.model ? `/visual-aids?model=${encodeURIComponent(sf.model)}` : null);
  const modalAids = (Array.isArray(modalAidsData) ? modalAidsData : []).filter((a) => a.isActive !== false);

  function refresh() { mutate(); mutateQuals(); mutateBalance(); }

  function closeStation() { setShowStation(false); setEditingId(null); }

  function openEdit(s: Station) {
    setSf({
      model: s.model, revision: s.revision, line: s.line, station: s.station,
      sequence: s.sequence, npExpected: s.npExpected ?? '', useFactor: s.useFactor,
      stdTimeSec: s.stdTimeSec, visualAidUrl: s.visualAidUrl ?? '', ctq: s.ctq,
    });
    setEditingId(s.id);
    setShowStation(true);
  }

  async function updateStation() {
    if (!editingId) return;
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/line-engineering/stations/${editingId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sequence: sf.sequence, npExpected: sf.npExpected, useFactor: sf.useFactor,
          stdTimeSec: sf.stdTimeSec, visualAidUrl: sf.visualAidUrl, ctq: sf.ctq,
        }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d?.message || 'No se pudo actualizar.', 'Ing. Industrial'); return; }
      toast.success('Estación actualizada.', 'Ing. Industrial');
      closeStation(); refresh();
    } catch { toast.error('Error de red.', 'Ing. Industrial'); } finally { setBusy(false); }
  }

  async function createStation() {
    if (!sf.model.trim() || !sf.station.trim()) { toast.error('Modelo y estación son obligatorios.', 'Ing. Industrial'); return; }
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/line-engineering/stations`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sf),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d?.message || 'No se pudo crear.', 'Ing. Industrial'); return; }
      toast.success('Estación agregada al layout.', 'Ing. Industrial');
      setShowStation(false);
      setSf({ ...sf, station: '', npExpected: '', sequence: sf.sequence + 10 });
      refresh();
    } catch { toast.error('Error de red.', 'Ing. Industrial'); } finally { setBusy(false); }
  }

  async function createQual() {
    if (!qf.model.trim() || !qf.line.trim()) { toast.error('Modelo y línea son obligatorios.', 'Ing. Industrial'); return; }
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/line-engineering/qualifications`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(qf),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d?.message || 'No se pudo calificar.', 'Ing. Industrial'); return; }
      toast.success('Modelo calificado en la línea.', 'Ing. Industrial');
      setShowQual(false); refresh();
    } catch { toast.error('Error de red.', 'Ing. Industrial'); } finally { setBusy(false); }
  }

  if (forbidden) {
    return (
      <div className="min-h-screen grid place-items-center text-black dark:text-white">
        <div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}>
          <Lock className="w-8 h-8 mx-auto mb-3 text-gray-400" />
          <h2 className="text-lg font-semibold">Sin acceso</h2>
          <p className="text-sm text-gray-400 mt-1">Necesitas permiso de ingeniería para disponer líneas.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-black dark:text-white">
      <div className={`${glass} sticky top-0 z-40 px-6 py-4`}>
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <Link href="/dashboard" className="p-2 -ml-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10"><ChevronLeft className="w-5 h-5" /></Link>
          <span className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: 'rgba(244,63,94,0.14)' }}><Gauge className="w-5 h-5" style={{ color: ROSE }} /></span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold leading-tight">Disposición de líneas · Ing. Industrial</h1>
            <p className="text-[12px] text-gray-400 leading-tight">Define qué se ensambla dónde y con qué — el operador ejecuta exactamente esto.</p>
          </div>
          <button onClick={() => { setQf({ ...qf, model }); setShowQual(true); }} className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium" style={{ background: `${BLUE}1f`, color: BLUE }}><Layers className="w-4 h-4" /> Calificar modelo↔línea</button>
          <button onClick={() => { setSf({ ...sf, model: model || sf.model }); setShowStation(true); }} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white" style={{ background: ROSE }}><Plus className="w-4 h-4" /> Estación</button>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 pt-8 pb-24">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          <Kpi label="Estaciones" value={kpis?.stationsTotal ?? stations.length} color={VIOLET} />
          <Kpi label="% Ayuda visual" value={pct(kpis?.pctVisualAid ?? 0)} color={GREEN} />
          <Kpi label="Modelos calificados" value={kpis?.modelsQualified ?? 0} color={BLUE} />
          <Kpi label="% Modelos balanceados" value={pct(kpis?.pctModelsBalanced ?? 0)} color={AMBER} />
          <Kpi label="Layouts incompletos" value={kpis?.incompleteLayouts ?? 0} color={ROSE} />
        </div>

        {/* Model selector */}
        {models.length > 0 && (
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            <span className="text-[12px] text-gray-400">Modelo:</span>
            {models.map((m) => {
              const key = `${m.model}|${m.revision}`;
              const on = key === activeModel;
              return (
                <button key={key} onClick={() => { setSelModel(key); setTaktOverride(''); }} className="px-3 py-1.5 rounded-lg text-[13px] font-medium" style={{ background: on ? ROSE : 'rgba(0,0,0,0.05)', color: on ? '#fff' : undefined }}>
                  {m.model} · {m.revision}
                </button>
              );
            })}
          </div>
        )}

        {/* View tabs — Balanceo (lista actual) coexiste con el Layout 2D, no lo reemplaza */}
        <div className="flex items-center gap-1 mb-5 p-1 rounded-xl bg-black/[0.04] dark:bg-white/[0.05] w-fit">
          {([['balance', 'Balanceo', BarChart3], ['layout', 'Layout 2D', Layers], ['cad3d', 'CAD 3D', Boxes]] as const).map(([key, label, Icon]) => {
            const on = view === key;
            const is3d = key === 'cad3d';
            return (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${on ? 'bg-white dark:bg-white/10 shadow-sm' : is3d ? 'text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                style={on ? { color: ROSE } : is3d ? { background: ROSE } : undefined}
              >
                <Icon className="w-4 h-4" /> {label}
              </button>
            );
          })}
        </div>

        {/* Layout 2D editor — additive, reusa las estaciones existentes. Aislado
            en un error boundary para que una falla del editor no tumbe la página. */}
        {view === 'layout' && (
          <ErrorBoundary
            label="LayoutEditor"
            fallback={(err, retry) => (
              <div className={`${glass} rounded-3xl p-10 text-center`}>
                <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-amber-500" />
                <h3 className="font-semibold">No se pudo abrir el editor de layout</h3>
                <p className="text-sm text-gray-400 mt-1">El resto de la página sigue disponible. Reintenta abrir el editor 2D.</p>
                <p className="mt-2 text-[11px] font-mono text-gray-400 break-all">{err.message}</p>
                <button onClick={retry} className="mt-4 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: ROSE }}>Reintentar</button>
              </div>
            )}
          >
            <LayoutEditor model={model} revision={revision} models={models} />
          </ErrorBoundary>
        )}

        {/* CAD 3D — editor full-screen (three.js). Se monta solo al activar la
            pestaña; se cierra con la X y regresa al Layout 2D. */}
        {view === 'cad3d' && (
          <Layout3DEditor model={model} revision={revision} open onClose={() => setView('layout')} />
        )}

        {view === 'balance' && (<>
        {/* Balance panel */}
        {balance && model && (
          <div className={`${glass} rounded-2xl p-5 mb-6`}>
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <div className="flex items-center gap-2"><Activity className="w-4 h-4" style={{ color: ROSE }} /><h3 className="font-semibold">Balanceo de línea · {balance.model} {balance.revision}</h3></div>
              <div className="flex items-center gap-2 text-[12px]">
                <span className="text-gray-400">Takt (s):</span>
                <input
                  type="number" min={0} value={taktOverride}
                  onChange={(e) => setTaktOverride(e.target.value)}
                  placeholder={qualTakt > 0 ? String(qualTakt) : '—'}
                  className="w-20 rounded-lg px-2 py-1 bg-black/[0.03] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 outline-none tabular-nums"
                />
                {taktOverride.trim() !== '' && <button onClick={() => setTaktOverride('')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">Reset</button>}
                <span className="text-gray-400">{qualTakt > 0 ? `calificación: ${qualTakt}s` : 'sin takt en calificación'}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Mini label="Takt" value={`${balance.taktSec}s`} />
              <Mini label="Cycle (cuello)" value={`${balance.lineCycleTimeSec}s`} sub={balance.bottleneckStation ?? '—'} color={balance.lineCycleTimeSec > balance.taktSec && balance.taktSec > 0 ? ROSE : GREEN} />
              <Mini label="Balance" value={pct(balance.balancePct)} color={balance.balancePct >= 0.85 ? GREEN : AMBER} />
              <Mini label="Throughput" value={`${balance.throughputPerHour}/h`} />
            </div>
            <Yamazumi route={route} taktSec={balance.taktSec} />
            {effTakt === 0 && (
              <div className="mt-3 flex items-center gap-2 text-[12px]" style={{ color: AMBER }}>
                <AlertTriangle className="w-4 h-4" /> Define un takt (arriba) o califica el modelo en una línea para comparar el ciclo contra el ritmo de demanda.
              </div>
            )}
            {balance.stationsOverTakt.length > 0 && (
              <div className="mt-3 flex items-center gap-2 text-[12px]" style={{ color: ROSE }}>
                <AlertTriangle className="w-4 h-4" /> Estaciones sobre takt: {balance.stationsOverTakt.join(', ')} — rebalancear.
              </div>
            )}
            {balance.completeness.incompleteStations > 0 && (
              <div className="mt-2 flex items-center gap-2 text-[12px]" style={{ color: AMBER }}>
                <AlertTriangle className="w-4 h-4" /> {balance.completeness.incompleteStations} estación(es) sin NP / factor de uso / ayuda visual.
              </div>
            )}
          </div>
        )}

        {/* Capacity calculator */}
        {model && <CapacityCalc model={model} revision={revision} lines={lines} />}

        {/* Routing table */}
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : route.length === 0 ? (
          <div className={`${glass} rounded-3xl p-12 text-center`}>
            <Inbox className="w-8 h-8 mx-auto mb-3 text-gray-400" />
            <h3 className="font-semibold">Sin estaciones en este layout</h3>
            <p className="text-sm text-gray-400 mt-1">Agrega estaciones con su NP esperado y factor de uso para que el operador sepa qué montar.</p>
          </div>
        ) : (
          <div className={`${glass} rounded-2xl overflow-hidden`}>
            <div className="flex items-center gap-2 px-5 py-3 border-b border-black/5 dark:border-white/10"><ListOrdered className="w-4 h-4 text-gray-400" /><h3 className="font-semibold text-sm">Ruteo / layout — {model} {revision}</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-[11px] uppercase tracking-wide text-gray-400 text-left">
                  <th className="px-4 py-2">Seq</th><th className="px-4 py-2">Estación</th><th className="px-4 py-2">Línea</th>
                  <th className="px-4 py-2">NP esperado</th><th className="px-4 py-2">Factor uso</th><th className="px-4 py-2">Tiempo std</th>
                  <th className="px-4 py-2">Ayuda</th><th className="px-4 py-2">CTQ</th><th className="px-4 py-2"></th>
                </tr></thead>
                <tbody>
                  {route.map((s) => (
                    <tr key={s.id} className="border-t border-black/5 dark:border-white/10">
                      <td className="px-4 py-2 font-mono text-gray-500">{s.sequence}</td>
                      <td className="px-4 py-2 font-medium">{s.station}</td>
                      <td className="px-4 py-2 text-gray-500">{s.line}</td>
                      <td className="px-4 py-2 font-mono">{s.npExpected || <span className="text-rose-500">— falta —</span>}</td>
                      <td className="px-4 py-2">{s.useFactor}</td>
                      <td className="px-4 py-2">{s.stdTimeSec}s</td>
                      <td className="px-4 py-2">{s.visualAidUrl ? <a href={s.visualAidUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: GREEN }}><ImageIcon className="w-4 h-4" /> Ver</a> : <span className="text-amber-500 text-xs">falta</span>}</td>
                      <td className="px-4 py-2">{s.ctq ? <Star className="w-4 h-4" style={{ color: AMBER }} fill={AMBER} /> : ''}</td>
                      <td className="px-4 py-2 text-right"><button onClick={() => openEdit(s)} className="p-1.5 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors" title="Editar estación"><Pencil className="w-4 h-4" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Qualifications */}
        {quals.length > 0 && (
          <div className="mt-8">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Layers className="w-4 h-4 text-gray-400" /> Matriz modelo↔línea</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {quals.map((q) => (
                <div key={q.id} className={`${glass} rounded-xl p-4 flex items-center justify-between`}>
                  <div><div className="font-medium">{q.model} · {q.revision} → {q.line}</div><div className="text-[12px] text-gray-400">Changeover {q.changeoverMinutes} min · takt {q.taktTargetSec}s</div></div>
                  <span className="text-[11px] px-2 py-0.5 rounded" style={{ background: q.active ? `${GREEN}1f` : 'rgba(0,0,0,0.06)', color: q.active ? GREEN : undefined }}>{q.active ? 'Activo' : 'Inactivo'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        </>)}
      </main>

      {/* Station modal */}
      {showStation && (
        <Modal title={editingId ? 'Editar estación' : 'Nueva estación'} onClose={closeStation}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Modelo">
              <select value={sf.model} onChange={(e) => setSf({ ...sf, model: e.target.value })} className="ci-input" disabled={!!editingId}>
                <option value="">Selecciona del maestro…</option>
                {masterModels.map((m) => <option key={m.id} value={m.modelNumber}>{m.modelNumber} · {m.name}</option>)}
              </select>
            </Field>
            <Field label="Revisión"><input value={sf.revision} onChange={(e) => setSf({ ...sf, revision: e.target.value })} className="ci-input" disabled={!!editingId} /></Field>
            <Field label="Línea"><input value={sf.line} onChange={(e) => setSf({ ...sf, line: e.target.value })} className="ci-input" disabled={!!editingId} /></Field>
            <Field label="Estación"><input value={sf.station} onChange={(e) => setSf({ ...sf, station: e.target.value })} className="ci-input" placeholder="EST-10" disabled={!!editingId} /></Field>
            <Field label="Secuencia"><input type="number" value={sf.sequence} onChange={(e) => setSf({ ...sf, sequence: Number(e.target.value) })} className="ci-input" /></Field>
            <Field label="NP esperado (poka-yoke)"><input value={sf.npExpected} onChange={(e) => setSf({ ...sf, npExpected: e.target.value })} className="ci-input" placeholder="CAP-0402-100NF" /></Field>
            <Field label="Factor de uso (cant/unidad)"><input type="number" step="0.001" value={sf.useFactor} onChange={(e) => setSf({ ...sf, useFactor: Number(e.target.value) })} className="ci-input" /></Field>
            <Field label="Tiempo std (s)"><input type="number" value={sf.stdTimeSec} onChange={(e) => setSf({ ...sf, stdTimeSec: Number(e.target.value) })} className="ci-input" /></Field>
            <Field label="Ayuda visual">
              <div className="space-y-1.5">
                {modalAids.length > 0 && (
                  <select value="" onChange={(e) => { if (e.target.value) setSf({ ...sf, visualAidUrl: `${API_BASE}/visual-aids/file/${e.target.value}` }); }} className="ci-input">
                    <option value="">Elegir de la biblioteca…</option>
                    {modalAids.map((a) => <option key={a.id} value={a.pdfUrl}>{a.title}{a.revision ? ` · rev ${a.revision}` : ''}</option>)}
                  </select>
                )}
                <input value={sf.visualAidUrl} onChange={(e) => setSf({ ...sf, visualAidUrl: e.target.value })} className="ci-input" placeholder="URL de la ayuda (o elige de la biblioteca)" />
              </div>
            </Field>
            <label className="flex items-center gap-2 mt-6"><input type="checkbox" checked={sf.ctq} onChange={(e) => setSf({ ...sf, ctq: e.target.checked })} /> <span className="text-sm">Característica crítica (CTQ)</span></label>
          </div>
          <Actions busy={busy} onCancel={closeStation} onSave={editingId ? updateStation : createStation} color={ROSE} />
        </Modal>
      )}

      {/* Qualification modal */}
      {showQual && (
        <Modal title="Calificar modelo en línea" onClose={() => setShowQual(false)}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Modelo">
              <select value={qf.model} onChange={(e) => setQf({ ...qf, model: e.target.value })} className="ci-input">
                <option value="">Selecciona del maestro…</option>
                {masterModels.map((m) => <option key={m.id} value={m.modelNumber}>{m.modelNumber} · {m.name}</option>)}
              </select>
            </Field>
            <Field label="Revisión"><input value={qf.revision} onChange={(e) => setQf({ ...qf, revision: e.target.value })} className="ci-input" /></Field>
            <Field label="Línea"><input value={qf.line} onChange={(e) => setQf({ ...qf, line: e.target.value })} className="ci-input" /></Field>
            <Field label="Changeover (min)"><input type="number" value={qf.changeoverMinutes} onChange={(e) => setQf({ ...qf, changeoverMinutes: Number(e.target.value) })} className="ci-input" /></Field>
            <Field label="Takt target (s)"><input type="number" value={qf.taktTargetSec} onChange={(e) => setQf({ ...qf, taktTargetSec: Number(e.target.value) })} className="ci-input" /></Field>
          </div>
          <Actions busy={busy} onCancel={() => setShowQual(false)} onSave={createQual} color={BLUE} />
        </Modal>
      )}

      <style jsx global>{`
        .ci-input { width: 100%; border-radius: 0.75rem; padding: 0.55rem 0.75rem; background: rgba(0,0,0,0.03); border: 1px solid rgba(0,0,0,0.08); outline: none; font-size: 0.875rem; }
        .ci-input:focus { border-color: ${ROSE}; }
        .ci-input:disabled { opacity: 0.55; cursor: not-allowed; }
        :global(.dark) .ci-input { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.1); }
      `}</style>
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className={`${glass} rounded-2xl p-4`}>
      <div className="text-[11px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-2xl font-semibold mt-1" style={{ color }}>{value}</div>
    </div>
  );
}
function Mini({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl p-3 bg-black/[0.03] dark:bg-white/[0.04]">
      <div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-xl font-semibold mt-0.5" style={{ color }}>{value}</div>
      {sub && <div className="text-[11px] text-gray-400 truncate">{sub}</div>}
    </div>
  );
}
/**
 * Yamazumi chart: one bar per station (its standard cycle time) against the takt
 * reference line. Bars above takt are bottlenecks (rose); the rest are within
 * beat (blue). Built from the same std times the balance math already uses, so
 * the chart and the KPIs never disagree.
 */
function Yamazumi({ route, taktSec }: { route: Station[]; taktSec: number }) {
  const data = route
    .filter((s) => Number(s.stdTimeSec) > 0)
    .sort((a, b) => a.sequence - b.sequence)
    .map((s) => ({
      station: s.station,
      time: Math.round(Number(s.stdTimeSec)),
      over: taktSec > 0 && Number(s.stdTimeSec) > taktSec + 1e-9,
    }));

  if (data.length === 0) {
    return (
      <div className="mt-4 flex items-center gap-2 text-[12px] text-gray-400">
        <BarChart3 className="w-4 h-4" />
        Captura el tiempo estándar de cada estación para ver el yamazumi (ciclo por estación vs takt).
      </div>
    );
  }

  const maxBar = Math.max(...data.map((d) => d.time), taktSec || 0);
  const angled = data.length > 6;

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[12px] font-semibold uppercase tracking-wide text-gray-400 flex items-center gap-1.5">
          <BarChart3 className="w-3.5 h-3.5" /> Yamazumi · ciclo por estación vs takt
        </h4>
        {taktSec > 0 && (
          <span className="text-[11px] flex items-center gap-1" style={{ color: ROSE }}>
            <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: ROSE }} /> Takt {Math.round(taktSec)}s
          </span>
        )}
      </div>
      <div style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.15)" vertical={false} />
            <XAxis
              dataKey="station"
              tick={{ fontSize: 11 }}
              interval={0}
              angle={angled ? -30 : 0}
              textAnchor={angled ? 'end' : 'middle'}
              height={angled ? 56 : 24}
            />
            <YAxis tick={{ fontSize: 11 }} domain={[0, Math.ceil(maxBar * 1.1)]} unit="s" width={46} />
            <Tooltip
              cursor={{ fill: 'rgba(120,120,120,0.08)' }}
              formatter={(v) => [`${v}s`, 'Ciclo']}
              contentStyle={{ borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)', fontSize: 12 }}
            />
            {taktSec > 0 && <ReferenceLine y={taktSec} stroke={ROSE} strokeDasharray="5 4" ifOverflow="extendDomain" />}
            <Bar dataKey="time" radius={[6, 6, 0, 0]} maxBarSize={64}>
              {data.map((d) => <Cell key={d.station} fill={d.over ? ROSE : BLUE} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] text-gray-400 mt-1">
        Barras sobre la línea de takt son cuellos de botella: rebalancea moviendo trabajo a estaciones con holgura.
      </p>
    </div>
  );
}

/**
 * Line capacity / load: required minutes (Σ cycle × demand + changeover) vs the
 * available minutes for a shift, with utilization% and a feasibility verdict.
 * Surfaces the existing `GET /line-engineering/capacity` (no UI before).
 */
function CapacityCalc({ model, revision, lines }: { model: string; revision: string; lines: string[] }) {
  const [open, setOpen] = useState(false);
  const [line, setLine] = useState('');
  const [availableMinutes, setAvailableMinutes] = useState('480');
  const [demandUnits, setDemandUnits] = useState('500');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Capacity | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const utilColor = res ? (res.utilizationPct > 100 ? ROSE : res.utilizationPct > 85 ? AMBER : GREEN) : undefined;

  async function calc() {
    const ln = (line || lines[0] || '').trim();
    if (!ln) { setErr('Selecciona una línea.'); return; }
    setBusy(true); setErr(null);
    try {
      const q = new URLSearchParams({ model, revision, line: ln, availableMinutes, demandUnits });
      const r = await apiFetch(`${API_BASE}/line-engineering/capacity?${q.toString()}`);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d?.message || 'No se pudo calcular.'); setRes(null); return; }
      setRes(d as Capacity);
    } catch { setErr('Error de red.'); } finally { setBusy(false); }
  }

  return (
    <div className={`${glass} rounded-2xl mb-6 overflow-hidden`}>
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-3 px-5 py-3 text-left">
        <Calculator className="w-4 h-4" style={{ color: BLUE }} />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm">Capacidad de línea · {model} {revision}</h3>
          <p className="text-[12px] text-gray-400">¿Cabe la demanda en el turno? Carga requerida vs disponible.</p>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-black/5 dark:border-white/10 pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
            <label className="block">
              <span className="block text-[12px] font-medium text-gray-500 mb-1">Línea</span>
              <select value={line} onChange={(e) => setLine(e.target.value)} className="ci-input">
                <option value="">{lines.length ? 'Selecciona línea…' : 'Sin líneas'}</option>
                {lines.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="block text-[12px] font-medium text-gray-500 mb-1">Minutos disponibles</span>
              <input type="number" min={0} value={availableMinutes} onChange={(e) => setAvailableMinutes(e.target.value)} className="ci-input tabular-nums" />
            </label>
            <label className="block">
              <span className="block text-[12px] font-medium text-gray-500 mb-1">Demanda (u)</span>
              <input type="number" min={0} value={demandUnits} onChange={(e) => setDemandUnits(e.target.value)} className="ci-input tabular-nums" />
            </label>
            <button onClick={calc} disabled={busy} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: BLUE }}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />} Calcular
            </button>
          </div>

          {err && <div className="mt-3 text-[12px]" style={{ color: ROSE }}>{err}</div>}

          {res && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <Mini label="Req. (min)" value={`${res.requiredMinutes}`} sub={res.changeoverMinutes ? `+${res.changeoverMinutes} changeover` : undefined} />
              <Mini label="Disponible (min)" value={`${res.availableMinutes}`} />
              <Mini label="Utilización" value={`${res.utilizationPct}%`} color={utilColor} />
              <div className="rounded-xl p-3 bg-black/[0.03] dark:bg-white/[0.04] flex flex-col justify-center">
                <div className="text-[10px] uppercase tracking-wide text-gray-400">Veredicto</div>
                <div className="text-sm font-semibold mt-0.5 flex items-center gap-1.5" style={{ color: res.feasible ? GREEN : ROSE }}>
                  {res.feasible ? <><CheckCircle2 className="w-4 h-4" /> Cabe</> : <><AlertTriangle className="w-4 h-4" /> No cabe</>}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const titleId = useId();
  const panelRef = useDialogA11y<HTMLDivElement>(onClose);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={`${glass} rounded-2xl p-5 w-full max-w-xl`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h3 id={titleId} className="font-semibold">{title}</h3><button onClick={onClose} aria-label="Cerrar" className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button></div>
        {children}
      </div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="block text-[12px] font-medium text-gray-500 mb-1">{label}</span>{children}</label>;
}
function Actions({ busy, onCancel, onSave, color }: { busy: boolean; onCancel: () => void; onSave: () => void; color: string }) {
  return (
    <div className="mt-5 flex justify-end gap-2">
      <button onClick={onCancel} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
      <button onClick={onSave} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: color }}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Guardar</button>
    </div>
  );
}
