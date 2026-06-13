'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft, ScanLine, Lock, Loader2, CheckCircle2, AlertTriangle, Ban,
  Image as ImageIcon, Star, Siren, Bug, Clock, PackageCheck, Maximize2,
  Minimize2, FileText, Hash, Layers, RefreshCw, Boxes, Wrench, ShieldAlert,
  LifeBuoy, Activity,
} from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const ORANGE = '#f97316';
const GREEN = '#10b981';
const RED = '#ef4444';
const AMBER = '#f59e0b';
const BLUE = '#3b82f6';
const VIOLET = '#7c3aed';
const STORE_KEY = 'axos_operator_terminal'; // remembers this station's identity (station + last WO) across reboots

// ── Types (shapes returned by the operator-terminal / production-plan API) ─────
interface WO { id: string; folio: string | null; model: string; revision: string; line: string; status: string; priority?: string; }
interface Ctx {
  workOrder: { id: string; folio: string | null; model: string; revision: string; line: string; quantityPlanned: number; quantityCompleted: number; consumptionMode: string; serialControl: string; taktTargetSec: number; programId?: string | null; };
  station: { station: string; sequence: number; npExpected: string | null; useFactor: number; stdTimeSec: number; visualAidUrl: string | null; ctq: boolean } | null;
  material: { part: string; requiredQty: number; stagedQty: number; status: string } | null;
  runnable: boolean; blockers: string[]; skill: { required: boolean; certified: boolean; reason: string | null }; authorized: boolean;
}
interface Kpis { unitsToday: number; eventsToday: number; openAndons: number; defectsToday: number; unitsPerHour: number; }
interface FloorEvent { id: string; type: string; status: string; severity: string; station: string | null; line: string | null; note: string | null; targetRole: string | null; raisedAt: string | null; acknowledgedAt: string | null; part: string | null; woFolio: string | null; }
interface HourPoint { hour: string; actual: number; planned: number; }
interface VisualAid { id: string; model: string; title: string; process: string; area?: string | null; revision?: string | null; pdfUrl: string; isActive: boolean; }
interface ConfirmEvent { id: string; part: string | null; backflushQty: number; units: number; unitSerial: string | null; outboxStatus: string; station: string; woFolio: string | null; }

// ANDON types map 1:1 to the operator-terminal backend enum + the role each routes to.
const ANDONS: { type: string; label: string; role: string; color: string; Icon: typeof Boxes }[] = [
  { type: 'ANDON_MATERIAL', label: 'Material', role: 'Surtidor', color: BLUE, Icon: Boxes },
  { type: 'ANDON_QUALITY', label: 'Calidad', role: 'Ing. Calidad', color: AMBER, Icon: ShieldAlert },
  { type: 'ANDON_MACHINE', label: 'Mantenimiento', role: 'Mantto', color: RED, Icon: Wrench },
  { type: 'ANDON_HELP', label: 'Ayuda', role: 'Supervisor', color: VIOLET, Icon: LifeBuoy },
  { type: 'ANDON_SAFETY', label: 'Seguridad', role: 'Supervisor', color: '#dc2626', Icon: Siren },
];

const TYPE_LABEL: Record<string, string> = {
  ANDON_MATERIAL: 'Andon material', ANDON_QUALITY: 'Andon calidad', ANDON_MACHINE: 'Andon mantto',
  ANDON_HELP: 'Andon ayuda', ANDON_SAFETY: 'Andon seguridad', DEFECT: 'Defecto', DOWNTIME: 'Paro',
};
const ROLE_LABEL: Record<string, string> = {
  materialist: 'Surtidor', quality_engineer: 'Ing. Calidad', maintenance_tech: 'Mantto', production_supervisor: 'Supervisor',
};
const STATUS_COLOR: Record<string, string> = { OPEN: RED, ACK: AMBER, RESOLVED: '#6b7280', CANCELLED: '#6b7280' };

const inputCls = 'w-full rounded-xl px-4 py-3 bg-white/[0.06] border border-white/15 outline-none text-white placeholder:text-white/35 focus:border-orange-400 transition-colors disabled:opacity-40';
const bigInputCls = 'w-full rounded-2xl px-5 py-5 bg-white/[0.06] border-2 border-white/20 outline-none text-white text-2xl sm:text-3xl font-mono tracking-wide placeholder:text-white/25 focus:border-orange-400 transition-colors disabled:opacity-40';

const isImg = (u: string) => /\.(png|jpe?g|webp|gif|svg|avif)(\?|$)/i.test(u);
const aidFile = (name: string) => `${API_BASE}/visual-aids/file/${encodeURIComponent(name)}`;
function ago(iso: string | null): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'ahora';
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}
function hourLabel(h: string): string {
  const parts = h.split(' ');
  return parts[1] || h;
}

export default function OperatorTerminalPage() {
  const toast = useToast();
  const [kiosk, setKiosk] = useState(false);

  const { data: wosData } = useApi<WO[]>('/production-plan', { refreshInterval: 15000 });
  const wos = useMemo(() => (Array.isArray(wosData) ? wosData.filter((w) => w.status !== 'COMPLETED' && w.status !== 'CANCELLED') : []), [wosData]);

  const [woId, setWoId] = useState('');
  const [woScan, setWoScan] = useState('');
  const [station, setStation] = useState('');
  const activeWo = woId || wos[0]?.id || '';
  const activeWoMeta = useMemo(() => wos.find((w) => w.id === activeWo) || null, [wos, activeWo]);
  const line = activeWoMeta?.line || '';

  const ctxUrl = activeWo && station ? `/operator-terminal/context?woId=${activeWo}&station=${encodeURIComponent(station)}` : null;
  const { data: ctx, forbidden, mutate } = useApi<Ctx>(ctxUrl, { refreshInterval: 8000 });
  const { data: kpis, mutate: mutateKpis } = useApi<Kpis>(`/operator-terminal/kpis${line ? `?line=${encodeURIComponent(line)}` : ''}`, { refreshInterval: 15000 });
  const { data: floorEvents, mutate: mutateFloor } = useApi<FloorEvent[]>(`/operator-terminal/floor-events${line ? `?line=${encodeURIComponent(line)}` : ''}`, { refreshInterval: 10000 });
  const { data: hourly, mutate: mutateHourly } = useApi<HourPoint[]>(activeWo ? `/operator-terminal/hour-by-hour/${activeWo}` : null, { refreshInterval: 30000 });
  const { data: aids } = useApi<VisualAid[]>(ctx?.workOrder?.model ? `/visual-aids?model=${encodeURIComponent(ctx.workOrder.model)}` : null, { refreshInterval: 0 });

  const [scan, setScan] = useState('');
  const [serial, setSerial] = useState('');
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [lastConfirm, setLastConfirm] = useState<ConfirmEvent | null>(null);
  const [poka, setPoka] = useState<{ checking: boolean; ok: boolean | null }>({ checking: false, ok: null });
  const [defectOpen, setDefectOpen] = useState(false);
  const [defectNote, setDefectNote] = useState('');
  const [defectSev, setDefectSev] = useState('HIGH');
  const scanRef = useRef<HTMLInputElement>(null);

  const wo = ctx?.workOrder;
  const stationValid = !!ctx?.station;
  const npExpected = ctx?.station?.npExpected ?? null;
  const useFactor = ctx?.station?.useFactor ?? 1;
  const pokaOk = !npExpected || poka.ok === true;
  const needsSerial = wo?.serialControl === 'BY_UNIT';
  const canConfirm = !!ctx?.runnable && stationValid && pokaOk && (!needsSerial || !!serial.trim()) && !busy;
  const previewUnits = wo?.consumptionMode === 'BY_QTY_FACTOR' ? Math.max(1, qty) : 1;
  const previewBackflush = npExpected ? +(previewUnits * useFactor).toFixed(3) : 0;
  const progress = wo && wo.quantityPlanned > 0 ? Math.min(100, Math.round((wo.quantityCompleted / wo.quantityPlanned) * 100)) : 0;
  const unitNo = wo ? Math.min(wo.quantityPlanned, wo.quantityCompleted + 1) : 0;

  const refresh = useCallback(() => { mutate(); mutateKpis(); mutateFloor(); mutateHourly(); }, [mutate, mutateKpis, mutateFloor, mutateHourly]);

  useEffect(() => { if (ctx?.runnable && pokaOk) scanRef.current?.focus(); }, [ctx?.runnable, pokaOk, activeWo, station]);

  // Restore the station's identity (station + last WO) on mount so a kiosk reboot
  // returns to the same place. Client-only (runs after hydration) → SSR-safe.
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORE_KEY) || '{}');
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration of the saved station identity (SSR-safe)
      if (typeof saved?.station === 'string' && saved.station) setStation(saved.station);
      if (typeof saved?.woId === 'string' && saved.woId) setWoId(saved.woId);
    } catch { /* ignore */ }
  }, []);

  // Persist on explicit selection (not via an effect, to avoid clobbering the
  // restored value during the first render pass).
  function persistSel(next: { woId?: string; station?: string }) {
    try { window.localStorage.setItem(STORE_KEY, JSON.stringify({ woId, station, ...next })); } catch { /* ignore */ }
  }
  function chooseWo(id: string) { setWoId(id); setLastConfirm(null); persistSel({ woId: id }); }
  function changeStation(s: string) { const v = s.toUpperCase(); setStation(v); setLastConfirm(null); persistSel({ station: v }); }

  // Live poka-yoke: the scanned part is validated against the routing via the
  // backend /verify endpoint (debounced). Advance stays blocked until it matches.
  useEffect(() => {
    const part = scan.trim();
    if (!activeWo || !station || !npExpected || !part) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset validation when scan/station is cleared
      setPoka({ checking: false, ok: null });
      return;
    }
    setPoka({ checking: true, ok: null });
    const t = setTimeout(async () => {
      try {
        const res = await apiFetch(`${API_BASE}/operator-terminal/verify?woId=${activeWo}&station=${encodeURIComponent(station)}&part=${encodeURIComponent(part)}`);
        const d = await res.json().catch(() => ({}));
        const data = (d && typeof d === 'object' && 'data' in d && 'success' in d) ? d.data : d;
        setPoka({ checking: false, ok: !!data?.ok });
      } catch { setPoka({ checking: false, ok: null }); }
    }, 280);
    return () => clearTimeout(t);
  }, [scan, activeWo, station, npExpected]);

  const enterKiosk = useCallback(() => {
    setKiosk(true);
    try { document.documentElement.requestFullscreen?.().catch(() => {}); } catch { /* ignore */ }
  }, []);
  const exitKiosk = useCallback(() => {
    setKiosk(false);
    try { if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); } catch { /* ignore */ }
  }, []);

  // Esc leaves the full-screen station mode (so an operator is never trapped).
  useEffect(() => {
    if (!kiosk) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') exitKiosk(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [kiosk, exitKiosk]);

  function selectWoByScan() {
    const q = woScan.trim();
    if (!q) return;
    const up = q.toUpperCase();
    const found = wos.find((w) => (w.folio || '').toUpperCase() === up || w.model.toUpperCase() === up || w.id === q);
    if (found) { chooseWo(found.id); setWoScan(''); }
    else toast.error('WO no encontrada en el plan en vivo.', 'Operador');
  }

  async function confirm() {
    if (!ctx?.station || !canConfirm) return;
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/operator-terminal/confirm`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          woId: activeWo, station,
          scannedPart: scan.trim() || undefined,
          units: wo?.consumptionMode === 'BY_QTY_FACTOR' ? Math.max(1, qty) : undefined,
          unitSerial: serial.trim() || undefined,
        }),
      });
      const d = await res.json().catch(() => ({}));
      const body = (d && typeof d === 'object' && 'data' in d && 'success' in d) ? d.data : d;
      if (!res.ok) { toast.error(body?.message || d?.message || 'No se pudo confirmar.', 'Operador'); return; }
      const ev = body?.event as ConfirmEvent | undefined;
      if (ev) setLastConfirm(ev);
      toast.success(`Confirmado · backflush ${ev?.backflushQty ?? previewBackflush} de ${ev?.part ?? npExpected ?? ''}`, 'Operador');
      setScan(''); setSerial(''); setPoka({ checking: false, ok: null });
      refresh(); scanRef.current?.focus();
    } catch { toast.error('Error de red.', 'Operador'); } finally { setBusy(false); }
  }

  async function andon(type: string) {
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/operator-terminal/andon`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, woId: activeWo || undefined, line: line || undefined, station: station || undefined }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d?.message || 'No se pudo disparar.', 'Andon'); return; }
      toast.success('Andon disparado — notificando al rol responsable.', 'Andon');
      mutateKpis(); mutateFloor();
    } catch { toast.error('Error de red.', 'Andon'); } finally { setBusy(false); }
  }

  async function submitDefect() {
    if (!defectNote.trim()) { toast.error('Describe el defecto.', 'Defecto'); return; }
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/operator-terminal/defect`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ woId: activeWo || undefined, line: line || undefined, station: station || undefined, part: npExpected || undefined, note: defectNote.trim(), severity: defectSev }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d?.message || 'No se pudo reportar.', 'Defecto'); return; }
      toast.success('Defecto reportado a calidad.', 'Defecto');
      setDefectNote(''); setDefectOpen(false); mutateKpis(); mutateFloor();
    } catch { toast.error('Error de red.', 'Defecto'); } finally { setBusy(false); }
  }

  // Visual aids of the model, station-relevant first.
  const stationAids = useMemo(() => {
    const list = (Array.isArray(aids) ? aids : []).filter((a) => a.isActive !== false);
    if (!station) return list;
    const s = station.toUpperCase();
    const match = list.filter((a) => [a.process, a.area, a.title].some((f) => (f || '').toUpperCase().includes(s)));
    return match.length ? match : list;
  }, [aids, station]);

  const activeCalls = useMemo(
    () => (Array.isArray(floorEvents) ? floorEvents : []).filter((f) => f.status === 'OPEN' || f.status === 'ACK').slice(0, 8),
    [floorEvents],
  );

  const hourRows = Array.isArray(hourly) ? hourly : [];
  const taktConfigured = (wo?.taktTargetSec ?? 0) > 0;
  const hourMax = Math.max(1, ...hourRows.map((h) => Math.max(h.actual, h.planned)));

  if (forbidden) {
    return (
      <div className="min-h-[60vh] grid place-items-center text-black dark:text-white">
        <div className="rounded-3xl p-10 text-center max-w-sm border border-white/10 bg-white/[0.04]">
          <Lock className="w-8 h-8 mx-auto mb-3 text-gray-400" />
          <h2 className="text-lg font-semibold">Sin acceso</h2>
          <p className="text-sm text-gray-400 mt-1">Necesitas permiso de ejecución de producción para usar la terminal.</p>
          <Link href="/dashboard" className="mt-4 inline-block text-sm font-medium" style={{ color: ORANGE }}>← Volver al inicio</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={kiosk ? 'fixed inset-0 z-[70] flex flex-col bg-[#0b0e14] text-white' : 'px-0 md:px-6 pb-12'}>
      <div className={kiosk ? 'flex-1 flex flex-col min-h-0' : 'mx-auto max-w-6xl bg-[#0b0e14] text-white md:rounded-3xl md:border md:border-white/10 overflow-hidden min-h-[calc(100vh-7rem)]'}>
        {/* Header */}
        <header className="sticky top-0 z-20 px-4 sm:px-6 py-3 border-b border-white/10 bg-[#0b0e14]/90 backdrop-blur">
          <div className="flex items-center gap-3">
            {kiosk ? (
              <button onClick={exitKiosk} className="px-3 py-2 -ml-1 rounded-xl text-sm font-medium hover:bg-white/10 inline-flex items-center gap-1.5"><ChevronLeft className="w-5 h-5" /> Salir</button>
            ) : (
              <Link href="/dashboard" className="p-2 -ml-2 rounded-xl hover:bg-white/10"><ChevronLeft className="w-5 h-5" /></Link>
            )}
            <span className="w-10 h-10 rounded-xl grid place-items-center flex-shrink-0" style={{ background: 'rgba(249,115,22,0.16)' }}><ScanLine className="w-5 h-5" style={{ color: ORANGE }} /></span>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold leading-tight">Terminal de operador</h1>
              <p className="text-[12px] text-white/45 leading-tight truncate">El sistema te dice qué montar, valida el poka-yoke y toma el consumo con un Enter.</p>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <HeaderStat label="u/h" value={kpis?.unitsPerHour ?? 0} />
              <HeaderStat label="Hoy" value={kpis?.unitsToday ?? 0} />
              <HeaderStat label="Andons" value={kpis?.openAndons ?? 0} color={(kpis?.openAndons ?? 0) > 0 ? RED : undefined} />
              <HeaderStat label="Defectos" value={kpis?.defectsToday ?? 0} color={(kpis?.defectsToday ?? 0) > 0 ? AMBER : undefined} />
            </div>
            <button onClick={refresh} className="p-2 rounded-xl hover:bg-white/10" title="Refrescar"><RefreshCw className="w-4 h-4 text-white/60" /></button>
            <button onClick={kiosk ? exitKiosk : enterKiosk} className="px-3 py-2 rounded-xl text-sm font-medium inline-flex items-center gap-1.5" style={{ background: 'rgba(255,255,255,0.08)' }}>
              {kiosk ? <><Minimize2 className="w-4 h-4" /> Ventana</> : <><Maximize2 className="w-4 h-4" /> <span className="hidden sm:inline">Pantalla completa</span></>}
            </button>
          </div>
        </header>

        <main className={kiosk ? 'flex-1 overflow-y-auto px-4 sm:px-6 py-5' : 'px-4 sm:px-6 py-5'}>
          {/* WO + station selectors */}
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              {wos.slice(0, 10).map((w) => {
                const on = w.id === activeWo;
                return (
                  <button key={w.id} onClick={() => chooseWo(w.id)} className="px-3 py-2 rounded-lg text-[13px] font-semibold transition-colors"
                    style={{ background: on ? ORANGE : 'rgba(255,255,255,0.07)', color: on ? '#fff' : 'rgba(255,255,255,0.8)' }}>
                    {w.folio || w.model}
                  </button>
                );
              })}
            </div>
            <input value={woScan} onChange={(e) => setWoScan(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') selectWoByScan(); }}
              placeholder="Escanea WO" className="w-32 rounded-lg px-3 py-2 bg-white/[0.06] border border-white/15 outline-none text-white text-sm placeholder:text-white/35 focus:border-orange-400" />
            <input value={station} onChange={(e) => changeStation(e.target.value)}
              placeholder="Tu estación (EST-10)" className="w-44 ml-auto rounded-lg px-3 py-2 bg-white/[0.06] border border-white/15 outline-none text-white text-sm placeholder:text-white/35 focus:border-orange-400" />
          </div>

          {!activeWo || !station ? (
            <div className="rounded-3xl p-12 text-center border border-white/10 bg-white/[0.03]">
              <ScanLine className="w-9 h-9 mx-auto mb-3 text-white/40" />
              <h3 className="font-semibold text-lg">Selecciona tu WO y estación</h3>
              <p className="text-sm text-white/45 mt-1">La terminal cargará el trabajo, la ayuda visual del paso y el material de tu estación.</p>
            </div>
          ) : !ctx ? (
            <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-white/40" /></div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* LEFT — work */}
                <div className="lg:col-span-2 space-y-4">
                  {/* Blockers / invalid-station banners */}
                  {!stationValid && (
                    <Banner color={AMBER} icon={<AlertTriangle className="w-5 h-5" />} title="Estación no reconocida en el ruteo">
                      <p className="text-sm text-white/70 mt-1">La estación <b>{station}</b> no está en el ruteo del modelo {wo?.model}. No puedes confirmar aquí — verifica el código de tu estación.</p>
                    </Banner>
                  )}
                  {stationValid && !ctx.runnable && (
                    <Banner color={RED} icon={<Ban className="w-5 h-5" />} title="No puedes avanzar">
                      <ul className="mt-2 space-y-1 text-sm">
                        {ctx.blockers.map((b, i) => <li key={i} className="flex items-start gap-2"><AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: RED }} /> {b}</li>)}
                      </ul>
                    </Banner>
                  )}

                  {/* Work card */}
                  <Card>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[12px] text-white/45 flex items-center gap-2 flex-wrap">
                          <span className="font-mono">{wo?.folio || '—'}</span>
                          {ctx.station && <span className="px-2 py-0.5 rounded-md font-semibold" style={{ background: 'rgba(249,115,22,0.16)', color: ORANGE }}>Paso {ctx.station.sequence} · {ctx.station.station}</span>}
                          {line && <span>Línea {line}</span>}
                        </div>
                        <div className="text-3xl font-semibold mt-1 truncate">{wo?.model} <span className="text-lg text-white/45">rev {wo?.revision}</span></div>
                      </div>
                      {ctx.station?.ctq && <span className="inline-flex items-center gap-1 text-[12px] px-2.5 py-1 rounded-lg flex-shrink-0" style={{ background: `${AMBER}24`, color: AMBER }}><Star className="w-3.5 h-3.5" fill={AMBER} /> CTQ</span>}
                    </div>

                    {/* Unit + progress */}
                    <div className="mt-4 flex items-end justify-between gap-4">
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-white/40">Unidad en curso</div>
                        <div className="text-2xl font-semibold">{unitNo} <span className="text-base text-white/45">/ {wo?.quantityPlanned}</span></div>
                      </div>
                      <div className="text-right text-[12px] text-white/45">
                        <div>{wo?.quantityCompleted} confirmadas · {progress}%</div>
                        {taktConfigured && <div>takt {wo?.taktTargetSec}s</div>}
                      </div>
                    </div>
                    <div className="mt-1.5 h-2.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: ORANGE }} /></div>

                    {/* NP esperado + material */}
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl p-3 bg-white/[0.04]">
                        <div className="text-[10px] uppercase tracking-wide text-white/40">NP esperado (poka-yoke)</div>
                        <div className="text-xl font-mono font-semibold">{npExpected || '—'}</div>
                        <div className="text-[11px] text-white/45">factor de uso {useFactor}{ctx.station?.stdTimeSec ? ` · std ${ctx.station.stdTimeSec}s` : ''}</div>
                      </div>
                      <div className="rounded-xl p-3 bg-white/[0.04]">
                        <div className="text-[10px] uppercase tracking-wide text-white/40">Material en línea</div>
                        {ctx.material ? (
                          <>
                            <div className="text-xl font-semibold" style={{ color: ctx.material.status === 'SHORTAGE' ? RED : GREEN }}>{ctx.material.stagedQty}</div>
                            <div className="text-[11px] text-white/45">req. {ctx.material.requiredQty} · {ctx.material.status}</div>
                          </>
                        ) : <div className="text-sm text-white/45 mt-1">sin seguimiento de surtido</div>}
                      </div>
                    </div>
                  </Card>

                  {/* Visual aid */}
                  <Card>
                    <div className="flex items-center gap-2 mb-3 text-sm font-semibold"><ImageIcon className="w-4 h-4" style={{ color: BLUE }} /> Ayuda visual del paso</div>
                    {ctx.station?.visualAidUrl ? (
                      <div className="mb-3">
                        {isImg(ctx.station.visualAidUrl) ? (
                          <a href={ctx.station.visualAidUrl} target="_blank" rel="noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={ctx.station.visualAidUrl} alt="Ayuda visual del paso" className="rounded-xl max-h-64 w-auto border border-white/10" />
                          </a>
                        ) : (
                          <a href={ctx.station.visualAidUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[13px] font-medium" style={{ color: BLUE }}><FileText className="w-4 h-4" /> Abrir ayuda visual del ruteo</a>
                        )}
                      </div>
                    ) : null}
                    {stationAids.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {stationAids.slice(0, 6).map((a) => (
                          <a key={a.id} href={aidFile(a.pdfUrl)} target="_blank" rel="noreferrer" className="block rounded-xl overflow-hidden border border-white/10 bg-white/[0.04] hover:border-white/25 transition-colors">
                            {isImg(a.pdfUrl) ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={aidFile(a.pdfUrl)} alt={a.title} className="w-full h-24 object-cover" />
                            ) : (
                              <div className="w-full h-24 grid place-items-center text-white/40"><FileText className="w-7 h-7" /></div>
                            )}
                            <div className="p-2">
                              <div className="text-[12px] font-medium truncate">{a.title}</div>
                              <div className="text-[10px] text-white/40 truncate">{a.process}{a.revision ? ` · rev ${a.revision}` : ''}</div>
                            </div>
                          </a>
                        ))}
                      </div>
                    ) : !ctx.station?.visualAidUrl ? (
                      <p className="text-sm text-white/40">Sin ayuda visual cargada para este modelo. Súbela en Ingeniería / Ayudas visuales.</p>
                    ) : null}
                  </Card>

                  {/* Scan + poka-yoke + confirm */}
                  <Card>
                    <div className="flex items-center gap-2 mb-3 text-sm font-semibold"><ScanLine className="w-4 h-4" style={{ color: ORANGE }} /> Escanea y confirma</div>
                    <input ref={scanRef} value={scan} disabled={!ctx.runnable || !stationValid}
                      onChange={(e) => setScan(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && canConfirm) confirm(); }}
                      placeholder={npExpected ? `Escanea ${npExpected}` : 'Escanea el componente'} className={bigInputCls} />

                    {/* live poka-yoke state */}
                    {npExpected && scan.trim() && (
                      <div className="mt-2 text-sm flex items-center gap-2">
                        {poka.checking ? <span className="text-white/50 inline-flex items-center gap-1.5"><Loader2 className="w-4 h-4 animate-spin" /> Validando…</span>
                          : poka.ok ? <span className="inline-flex items-center gap-1.5 font-medium" style={{ color: GREEN }}><CheckCircle2 className="w-4 h-4" /> Parte correcta</span>
                            : <span className="inline-flex items-center gap-1.5 font-medium" style={{ color: RED }}><Ban className="w-4 h-4" /> No coincide — esperado {npExpected}</span>}
                      </div>
                    )}

                    {/* serial / lot */}
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-white/45 flex items-center gap-1 mb-1"><Hash className="w-3 h-3" /> Serie {needsSerial && <span style={{ color: RED }}>*</span>}</label>
                        <input value={serial} disabled={!ctx.runnable || !stationValid} onChange={(e) => setSerial(e.target.value)}
                          placeholder={needsSerial ? 'Serial de la unidad (obligatorio)' : 'Serial (opcional)'} className={inputCls} />
                      </div>
                      <div>
                        <label className="text-[11px] text-white/45 flex items-center gap-1 mb-1"><Layers className="w-3 h-3" /> Lote <span className="text-white/30">· backend pendiente</span></label>
                        <input disabled value="" placeholder="Captura de lote (próximamente)" className={inputCls} title="El backend SF aún no acepta lote en la confirmación; queda como tarea backend." />
                      </div>
                    </div>

                    {wo?.consumptionMode === 'BY_QTY_FACTOR' && (
                      <div className="mt-3">
                        <label className="text-[11px] text-white/45 mb-1 block">Cantidad terminada</label>
                        <input type="number" min={1} value={qty} disabled={!ctx.runnable || !stationValid} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} className={inputCls} />
                      </div>
                    )}

                    {/* backflush preview */}
                    {npExpected && (
                      <div className="mt-3 text-[12px] text-white/55 rounded-lg px-3 py-2 bg-white/[0.04]">
                        Al confirmar se hará <b className="text-white">backflush de {previewBackflush}</b> de {npExpected} {wo?.consumptionMode === 'BY_QTY_FACTOR' ? `(${previewUnits} × ${useFactor})` : `(1 × ${useFactor})`} e incrementará la WO.
                      </div>
                    )}

                    <button onClick={confirm} disabled={!canConfirm}
                      className="mt-4 w-full py-6 rounded-2xl text-white text-2xl font-bold disabled:opacity-40 inline-flex items-center justify-center gap-2.5 transition-colors"
                      style={{ background: canConfirm ? GREEN : '#374151' }}>
                      {busy ? <Loader2 className="w-6 h-6 animate-spin" /> : <CheckCircle2 className="w-6 h-6" />} Confirmar producción
                    </button>
                    {!canConfirm && stationValid && ctx.runnable && npExpected && !pokaOk && (
                      <p className="mt-2 text-[12px] text-center" style={{ color: AMBER }}>Escanea la parte correcta para habilitar la confirmación (no se puede saltar el paso).</p>
                    )}
                  </Card>

                  {/* Last backflush confirmation */}
                  {lastConfirm && (
                    <div className="rounded-2xl p-4 border" style={{ borderColor: `${GREEN}55`, background: `${GREEN}12` }}>
                      <div className="flex items-center gap-2 font-semibold" style={{ color: GREEN }}><CheckCircle2 className="w-5 h-5" /> Producción confirmada</div>
                      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        <KV label="Backflush" value={`${lastConfirm.backflushQty} ${lastConfirm.part ?? ''}`} />
                        <KV label="Unidades" value={String(lastConfirm.units)} />
                        <KV label="Serie" value={lastConfirm.unitSerial || '—'} />
                        <KV label="SAP 261" value={lastConfirm.outboxStatus} />
                      </div>
                    </div>
                  )}
                </div>

                {/* RIGHT — signals */}
                <div className="space-y-4">
                  {/* Andon */}
                  <Card>
                    <div className="flex items-center gap-2 mb-3 font-semibold"><Siren className="w-4 h-4" style={{ color: RED }} /> Andon</div>
                    <div className="grid grid-cols-1 gap-2">
                      {ANDONS.map((a) => (
                        <button key={a.type} onClick={() => andon(a.type)} disabled={busy}
                          className="py-3.5 px-3 rounded-xl text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2.5 transition-transform active:scale-[0.98]"
                          style={{ background: `${a.color}22`, color: a.color }}>
                          <a.Icon className="w-5 h-5 flex-shrink-0" />
                          <span>{a.label}</span>
                          <span className="ml-auto text-[11px] font-medium opacity-70">→ {a.role}</span>
                        </button>
                      ))}
                    </div>
                    <button onClick={() => setDefectOpen((v) => !v)} disabled={busy} className="mt-2 w-full py-3 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50" style={{ background: `${AMBER}22`, color: AMBER }}>
                      <Bug className="w-4 h-4" /> Reportar defecto
                    </button>
                    {defectOpen && (
                      <div className="mt-2 rounded-xl p-3 bg-white/[0.04] space-y-2">
                        <textarea value={defectNote} onChange={(e) => setDefectNote(e.target.value)} rows={2} placeholder="Describe el defecto (ej. soldadura fría en J3)" className={`${inputCls} resize-none`} />
                        <div className="flex items-center gap-2">
                          <select value={defectSev} onChange={(e) => setDefectSev(e.target.value)} className={`${inputCls} py-2`}>
                            <option value="LOW">Baja</option><option value="MEDIUM">Media</option><option value="HIGH">Alta</option><option value="CRITICAL">Crítica</option>
                          </select>
                          <button onClick={submitDefect} disabled={busy} className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background: AMBER }}>Enviar</button>
                        </div>
                      </div>
                    )}
                  </Card>

                  {/* Active calls + their state */}
                  <Card>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 font-semibold"><Activity className="w-4 h-4" style={{ color: AMBER }} /> Llamadas activas</div>
                      <span className="text-[12px] text-white/45">{activeCalls.length}</span>
                    </div>
                    {activeCalls.length === 0 ? (
                      <p className="text-sm text-white/40">Sin llamadas abiertas en la línea.</p>
                    ) : (
                      <ul className="space-y-2">
                        {activeCalls.map((f) => (
                          <li key={f.id} className="rounded-xl p-2.5 bg-white/[0.04]">
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-medium">{TYPE_LABEL[f.type] || f.type}</span>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${STATUS_COLOR[f.status] || '#6b7280'}22`, color: STATUS_COLOR[f.status] || '#9ca3af' }}>
                                {f.status === 'OPEN' ? 'ABIERTA' : f.status === 'ACK' ? 'ATENDIENDO' : f.status}
                              </span>
                              <span className="ml-auto text-[11px] text-white/40">{ago(f.raisedAt)}</span>
                            </div>
                            <div className="text-[11px] text-white/45 mt-0.5">
                              {f.station ? `${f.station} · ` : ''}{f.targetRole ? (ROLE_LABEL[f.targetRole] || f.targetRole) : ''}{f.note ? ` · ${f.note}` : ''}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>

                  {/* Skill / cert */}
                  {ctx.skill.required && (
                    <div className="rounded-2xl p-3 border text-sm flex items-center gap-2" style={{ borderColor: ctx.skill.certified ? `${GREEN}44` : `${RED}44`, background: ctx.skill.certified ? `${GREEN}12` : `${RED}12`, color: ctx.skill.certified ? GREEN : RED }}>
                      <PackageCheck className="w-4 h-4 flex-shrink-0" /> {ctx.skill.certified ? 'Certificado para esta estación' : (ctx.skill.reason || 'No certificado para esta estación')}
                    </div>
                  )}
                </div>
              </div>

              {/* Hour-by-hour (meta vs real) */}
              <Card className="mt-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 font-semibold"><Clock className="w-4 h-4" style={{ color: BLUE }} /> Hora por hora del turno</div>
                  <span className="text-[12px] text-white/45">meta vs real</span>
                </div>
                {!taktConfigured && (
                  <p className="text-[12px] mb-3 rounded-lg px-3 py-2" style={{ background: `${AMBER}14`, color: AMBER }}>
                    Meta por hora no configurada (takt 0). Define el takt en Ingeniería de línea para ver la meta. Tarea backend: poblar takt del modelo↔línea.
                  </p>
                )}
                {hourRows.length === 0 ? (
                  <p className="text-sm text-white/40">Aún no hay confirmaciones este turno para esta WO.</p>
                ) : (
                  <div className="space-y-2">
                    {hourRows.map((h) => {
                      const met = taktConfigured ? h.actual >= h.planned : true;
                      return (
                        <div key={h.hour} className="flex items-center gap-3">
                          <span className="w-12 text-[12px] text-white/50 font-mono flex-shrink-0">{hourLabel(h.hour)}</span>
                          <div className="flex-1 h-6 rounded-lg bg-white/[0.05] relative overflow-hidden">
                            <div className="absolute inset-y-0 left-0 rounded-lg" style={{ width: `${(h.actual / hourMax) * 100}%`, background: met ? GREEN : AMBER }} />
                            {taktConfigured && h.planned > 0 && (
                              <div className="absolute inset-y-0" style={{ left: `${Math.min(100, (h.planned / hourMax) * 100)}%`, width: 2, background: '#fff' }} title={`meta ${h.planned}`} />
                            )}
                          </div>
                          <span className="w-20 text-right text-[12px] flex-shrink-0"><b style={{ color: met ? GREEN : AMBER }}>{h.actual}</b><span className="text-white/40"> / {taktConfigured ? h.planned : '—'}</span></span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

// ── Local presentational helpers ──────────────────────────────────────────────
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl p-4 sm:p-5 border border-white/10 bg-white/[0.03] ${className}`}>{children}</div>;
}
function Banner({ color, icon, title, children }: { color: string; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: `${color}14`, border: `1px solid ${color}55` }}>
      <div className="flex items-center gap-2 font-semibold" style={{ color }}>{icon} {title}</div>
      {children}
    </div>
  );
}
function HeaderStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="px-3 py-1.5 rounded-xl bg-white/[0.06] text-center min-w-[58px]">
      <div className="text-base font-semibold leading-none" style={{ color }}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-white/40 mt-0.5">{label}</div>
    </div>
  );
}
function KV({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-white/40">{label}</div>
      <div className="font-medium truncate">{value}</div>
    </div>
  );
}
