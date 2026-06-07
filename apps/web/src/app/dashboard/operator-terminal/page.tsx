'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft, ScanLine, Lock, Loader2, CheckCircle2, AlertTriangle, Ban,
  Image as ImageIcon, Star, Siren, Bug, Clock, PackageCheck,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const ORANGE = '#f97316';
const GREEN = '#10b981';
const RED = '#ef4444';
const AMBER = '#f59e0b';
const BLUE = '#3b82f6';

interface WO { id: string; folio: string | null; model: string; revision: string; line: string; status: string; }
interface Ctx {
  workOrder: { id: string; folio: string | null; model: string; revision: string; quantityPlanned: number; quantityCompleted: number; consumptionMode: string; serialControl: string; taktTargetSec: number; };
  station: { station: string; npExpected: string | null; useFactor: number; stdTimeSec: number; visualAidUrl: string | null; ctq: boolean } | null;
  material: { part: string; requiredQty: number; stagedQty: number; status: string } | null;
  runnable: boolean; blockers: string[]; skill: { required: boolean; certified: boolean }; authorized: boolean;
}
interface Kpis { unitsToday: number; openAndons: number; defectsToday: number; unitsPerHour: number; }

const ANDONS: { type: string; label: string; color: string }[] = [
  { type: 'ANDON_MATERIAL', label: 'Material', color: BLUE },
  { type: 'ANDON_QUALITY', label: 'Calidad', color: AMBER },
  { type: 'ANDON_MACHINE', label: 'Máquina', color: RED },
  { type: 'ANDON_HELP', label: 'Ayuda', color: '#7c3aed' },
  { type: 'ANDON_SAFETY', label: 'Seguridad', color: '#dc2626' },
];

export default function OperatorTerminalPage() {
  const toast = useToast();
  const { data: wosData } = useApi<WO[]>('/production-plan');
  const { data: kpis, mutate: mutateKpis } = useApi<Kpis>('/operator-terminal/kpis');
  const wos = useMemo(() => (Array.isArray(wosData) ? wosData.filter((w) => w.status !== 'COMPLETED' && w.status !== 'CANCELLED') : []), [wosData]);

  const [woId, setWoId] = useState('');
  const [station, setStation] = useState('');
  const activeWo = woId || wos[0]?.id || '';
  const ctxUrl = activeWo && station ? `/operator-terminal/context?woId=${activeWo}&station=${encodeURIComponent(station)}` : null;
  const { data: ctx, forbidden, mutate } = useApi<Ctx>(ctxUrl, { refreshInterval: 8000 });

  const [scan, setScan] = useState('');
  const [serial, setSerial] = useState('');
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (ctx?.runnable) scanRef.current?.focus(); }, [ctx?.runnable, activeWo, station]);

  function refresh() { mutate(); mutateKpis(); }

  async function confirm() {
    if (!ctx?.station) return;
    if (ctx.workOrder.serialControl === 'BY_UNIT' && !serial.trim()) { toast.error('Este programa exige serial por unidad.', 'Operador'); return; }
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/operator-terminal/confirm`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          woId: activeWo, station,
          scannedPart: scan.trim() || undefined,
          units: ctx.workOrder.consumptionMode === 'BY_QTY_FACTOR' ? qty : undefined,
          unitSerial: serial.trim() || undefined,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d?.message || 'No se pudo confirmar.', 'Operador'); return; }
      toast.success(`Confirmado · backflush ${d?.event?.backflushQty ?? ''}`, 'Operador');
      setScan(''); setSerial(''); refresh(); scanRef.current?.focus();
    } catch { toast.error('Error de red.', 'Operador'); } finally { setBusy(false); }
  }

  async function andon(type: string) {
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/operator-terminal/andon`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, woId: activeWo || undefined, station: station || undefined }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d?.message || 'No se pudo disparar.', 'Andon'); return; }
      toast.success('Andon disparado — notificando al rol responsable.', 'Andon'); mutateKpis();
    } catch { toast.error('Error de red.', 'Andon'); } finally { setBusy(false); }
  }

  async function defect() {
    const note = window.prompt('Describe el defecto:');
    if (!note) return;
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/operator-terminal/defect`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ woId: activeWo || undefined, station: station || undefined, part: ctx?.station?.npExpected || undefined, note, severity: 'HIGH' }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d?.message || 'No se pudo reportar.', 'Defecto'); return; }
      toast.success('Defecto reportado a calidad.', 'Defecto'); mutateKpis();
    } catch { toast.error('Error de red.', 'Defecto'); } finally { setBusy(false); }
  }

  if (forbidden) {
    return (
      <div className="min-h-screen grid place-items-center text-black dark:text-white">
        <div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}>
          <Lock className="w-8 h-8 mx-auto mb-3 text-gray-400" />
          <h2 className="text-lg font-semibold">Sin acceso</h2>
          <p className="text-sm text-gray-400 mt-1">Necesitas permiso de ejecución de producción.</p>
        </div>
      </div>
    );
  }

  const wo = ctx?.workOrder;
  const progress = wo && wo.quantityPlanned > 0 ? Math.min(100, Math.round((wo.quantityCompleted / wo.quantityPlanned) * 100)) : 0;

  return (
    <div className="min-h-screen text-black dark:text-white">
      <div className={`${glass} sticky top-0 z-40 px-6 py-4`}>
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Link href="/dashboard" className="p-2 -ml-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10"><ChevronLeft className="w-5 h-5" /></Link>
          <span className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: 'rgba(249,115,22,0.14)' }}><ScanLine className="w-5 h-5" style={{ color: ORANGE }} /></span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold leading-tight">Terminal de operador</h1>
            <p className="text-[12px] text-gray-400 leading-tight">El sistema te dice qué montar, te avisa faltantes y toma el consumo con un Enter.</p>
          </div>
          <div className="hidden sm:flex items-center gap-3 text-[12px]">
            <span className="text-gray-400">u/h <b className="text-black dark:text-white">{kpis?.unitsPerHour ?? 0}</b></span>
            <span className="text-gray-400">hoy <b className="text-black dark:text-white">{kpis?.unitsToday ?? 0}</b></span>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 pt-6 pb-24">
        {/* WO + station pickers */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {wos.map((w) => {
            const on = w.id === activeWo;
            return <button key={w.id} onClick={() => setWoId(w.id)} className="px-3 py-1.5 rounded-lg text-[13px] font-medium" style={{ background: on ? ORANGE : 'rgba(0,0,0,0.05)', color: on ? '#fff' : undefined }}>{w.folio || w.model}</button>;
          })}
          <input value={station} onChange={(e) => setStation(e.target.value.toUpperCase())} placeholder="Tu estación (ej. EST-10)" className="ci-input w-44 ml-auto" />
        </div>

        {!activeWo || !station ? (
          <div className={`${glass} rounded-3xl p-12 text-center`}>
            <ScanLine className="w-8 h-8 mx-auto mb-3 text-gray-400" />
            <h3 className="font-semibold">Selecciona tu WO y estación</h3>
            <p className="text-sm text-gray-400 mt-1">El terminal cargará el trabajo, la ayuda visual y el material de tu estación.</p>
          </div>
        ) : !ctx ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Work card */}
            <div className="lg:col-span-2 space-y-4">
              {/* Blockers banner */}
              {!ctx.runnable && (
                <div className="rounded-2xl p-4" style={{ background: `${RED}14`, border: `1px solid ${RED}55` }}>
                  <div className="flex items-center gap-2 font-semibold" style={{ color: RED }}><Ban className="w-5 h-5" /> No puedes avanzar</div>
                  <ul className="mt-2 space-y-1 text-sm">
                    {ctx.blockers.map((b, i) => <li key={i} className="flex items-start gap-2"><AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: RED }} /> {b}</li>)}
                  </ul>
                </div>
              )}

              <div className={`${glass} rounded-2xl p-5`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[12px] text-gray-400">{wo?.folio} · {ctx.station?.station}</div>
                    <div className="text-2xl font-semibold">{wo?.model} <span className="text-base text-gray-400">rev {wo?.revision}</span></div>
                  </div>
                  {ctx.station?.ctq && <span className="inline-flex items-center gap-1 text-[12px] px-2 py-1 rounded-lg" style={{ background: `${AMBER}1f`, color: AMBER }}><Star className="w-3.5 h-3.5" fill={AMBER} /> CTQ</span>}
                </div>

                {/* Expected NP + visual aid */}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl p-3 bg-black/[0.03] dark:bg-white/[0.04]">
                    <div className="text-[10px] uppercase tracking-wide text-gray-400">NP esperado</div>
                    <div className="text-lg font-mono font-semibold">{ctx.station?.npExpected || '—'}</div>
                    <div className="text-[11px] text-gray-400">factor de uso {ctx.station?.useFactor}</div>
                  </div>
                  <div className="rounded-xl p-3 bg-black/[0.03] dark:bg-white/[0.04]">
                    <div className="text-[10px] uppercase tracking-wide text-gray-400">Material en línea</div>
                    {ctx.material ? (
                      <>
                        <div className="text-lg font-semibold" style={{ color: ctx.material.status === 'SHORTAGE' ? RED : GREEN }}>{ctx.material.stagedQty}</div>
                        <div className="text-[11px] text-gray-400">req. {ctx.material.requiredQty} · {ctx.material.status}</div>
                      </>
                    ) : <div className="text-sm text-gray-400 mt-1">sin seguimiento</div>}
                  </div>
                </div>

                {ctx.station?.visualAidUrl && (
                  <a href={ctx.station.visualAidUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-[13px] font-medium" style={{ color: BLUE }}><ImageIcon className="w-4 h-4" /> Ver ayuda visual del paso</a>
                )}

                {/* Progress */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-[12px] text-gray-400"><span>Avance</span><span>{wo?.quantityCompleted}/{wo?.quantityPlanned}</span></div>
                  <div className="mt-1 h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${progress}%`, background: ORANGE }} /></div>
                </div>

                {/* Scan + confirm */}
                <div className="mt-5 space-y-3">
                  <input ref={scanRef} value={scan} disabled={!ctx.runnable}
                    onChange={(e) => setScan(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') confirm(); }}
                    placeholder={ctx.station?.npExpected ? `Escanea ${ctx.station.npExpected}` : 'Escanea el componente'}
                    className="ci-input ci-big" />
                  {wo?.serialControl === 'BY_UNIT' && (
                    <input value={serial} disabled={!ctx.runnable} onChange={(e) => setSerial(e.target.value)} placeholder="Serial de la unidad (genealogía)" className="ci-input" />
                  )}
                  {wo?.consumptionMode === 'BY_QTY_FACTOR' && (
                    <input type="number" min={1} value={qty} disabled={!ctx.runnable} onChange={(e) => setQty(Number(e.target.value))} placeholder="Cantidad terminada" className="ci-input" />
                  )}
                  <button onClick={confirm} disabled={!ctx.runnable || busy}
                    className="w-full py-4 rounded-2xl text-white text-lg font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
                    style={{ background: ctx.runnable ? GREEN : '#9ca3af' }}>
                    {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />} Confirmar producción
                  </button>
                </div>
              </div>
            </div>

            {/* Side: andon + defect */}
            <div className="space-y-4">
              <div className={`${glass} rounded-2xl p-4`}>
                <div className="flex items-center gap-2 mb-3 font-semibold"><Siren className="w-4 h-4" style={{ color: RED }} /> Andon</div>
                <div className="grid grid-cols-2 gap-2">
                  {ANDONS.map((a) => (
                    <button key={a.type} onClick={() => andon(a.type)} disabled={busy} className="py-3 rounded-xl text-sm font-medium disabled:opacity-50" style={{ background: `${a.color}1f`, color: a.color }}>{a.label}</button>
                  ))}
                </div>
                <button onClick={defect} disabled={busy} className="mt-2 w-full py-3 rounded-xl text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50" style={{ background: `${AMBER}1f`, color: AMBER }}><Bug className="w-4 h-4" /> Reportar defecto</button>
              </div>

              <div className={`${glass} rounded-2xl p-4`}>
                <div className="flex items-center gap-2 mb-2 text-[12px] text-gray-400"><Clock className="w-4 h-4" /> Estado de turno</div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <Mini label="u/h" value={kpis?.unitsPerHour ?? 0} />
                  <Mini label="Hoy" value={kpis?.unitsToday ?? 0} />
                  <Mini label="Andons" value={kpis?.openAndons ?? 0} color={RED} />
                  <Mini label="Defectos" value={kpis?.defectsToday ?? 0} color={AMBER} />
                </div>
                {ctx.skill.required && (
                  <div className="mt-3 text-[11px] flex items-center gap-1.5" style={{ color: ctx.skill.certified ? GREEN : RED }}>
                    <PackageCheck className="w-3.5 h-3.5" /> {ctx.skill.certified ? 'Certificado para esta estación' : 'No certificado'}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <style jsx global>{`
        .ci-input { width: 100%; border-radius: 0.75rem; padding: 0.6rem 0.8rem; background: rgba(0,0,0,0.03); border: 1px solid rgba(0,0,0,0.08); outline: none; font-size: 0.9rem; }
        .ci-input:focus { border-color: ${ORANGE}; }
        .ci-big { font-size: 1.25rem; padding: 1rem; font-family: ui-monospace, monospace; }
        :global(.dark) .ci-input { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.1); }
      `}</style>
    </div>
  );
}

function Mini({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-xl p-2 bg-black/[0.03] dark:bg-white/[0.04]">
      <div className="text-xl font-semibold" style={{ color }}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div>
    </div>
  );
}
