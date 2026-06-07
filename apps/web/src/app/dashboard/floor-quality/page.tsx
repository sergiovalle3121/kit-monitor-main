'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft, ShieldX, Plus, Lock, Loader2, Inbox, X, ArrowRight,
  Search, AlertTriangle, Camera, FileWarning,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const RED = '#ef4444';
const AMBER = '#f59e0b';
const GREEN = '#10b981';
const BLUE = '#3b82f6';
const VIOLET = '#7c3aed';
const GRAY = '#6b7280';

type HStatus = 'HELD' | 'MRB_REVIEW' | 'DISPOSITIONED' | 'REWORK' | 'REINSPECT' | 'CLOSED' | 'CANCELLED';
type Disp = 'USE_AS_IS' | 'REWORK' | 'REPAIR' | 'SCRAP' | 'RTV' | 'SORT';

interface Hold {
  id: string; folio: string | null; origin: string; part: string; qty: number; lot: string | null; serial: string | null;
  woFolio: string | null; station: string | null; defectType: string | null; severity: string; status: HStatus;
  disposition: Disp | null; signedBy: string | null;
}
interface Kpis { openHolds: number; useAsIs: number; pctUseAsIs: number; scrapQty: number; reworkHours: number; avgDispositionDays: number; overdue: number; }
interface ConsRow { id: string; woFolio: string | null; model: string; station: string; part: string | null; unitSerial: string | null; createdAt: string; }

const SMETA: Record<HStatus, { label: string; color: string }> = {
  HELD: { label: 'Retenido', color: RED }, MRB_REVIEW: { label: 'MRB', color: AMBER },
  DISPOSITIONED: { label: 'Dispuesto', color: VIOLET }, REWORK: { label: 'Retrabajo', color: BLUE },
  REINSPECT: { label: 'Re-inspección', color: BLUE }, CLOSED: { label: 'Cerrado', color: GREEN }, CANCELLED: { label: 'Cancelado', color: GRAY },
};
const ORDER: HStatus[] = ['HELD', 'MRB_REVIEW', 'DISPOSITIONED', 'REWORK', 'REINSPECT', 'CLOSED'];
const DISPS: Disp[] = ['USE_AS_IS', 'REWORK', 'REPAIR', 'SCRAP', 'RTV', 'SORT'];
const pct = (n: number) => `${Math.round((n || 0) * 100)}%`;

export default function FloorQualityPage() {
  const toast = useToast();
  const { data: kpis, mutate: mutateKpis } = useApi<Kpis>('/floor-quality/kpis');
  const { data, isLoading, forbidden, mutate } = useApi<Hold[]>('/floor-quality/holds');
  const holds = Array.isArray(data) ? data : [];

  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({ origin: 'IN_PROCESS', part: '', qty: 1, lot: '', serial: '', woId: '', station: '', defectType: '', severity: 'MEDIUM', photoUrl: '' });
  const [wu, setWu] = useState('');
  const [wuRows, setWuRows] = useState<ConsRow[] | null>(null);

  function refresh() { mutate(); mutateKpis(); }

  async function create() {
    if (!form.part.trim()) { toast.error('NP es obligatorio.', 'Calidad'); return; }
    setBusy('new');
    try {
      const res = await apiFetch(`${API_BASE}/floor-quality/holds`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d?.message || 'No se pudo crear.', 'Calidad'); return; }
      toast.success('Hold creado — material en cuarentena.', 'Calidad'); setShowForm(false); refresh();
    } catch { toast.error('Error de red.', 'Calidad'); } finally { setBusy(null); }
  }

  async function act(hold: Hold, action: string, body?: Record<string, unknown>) {
    setBusy(hold.id);
    try {
      const res = await apiFetch(`${API_BASE}/floor-quality/holds/${hold.id}/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d?.message || 'No se pudo.', 'Calidad'); return; }
      toast.success('Actualizado.', 'Calidad'); refresh();
    } catch { toast.error('Error de red.', 'Calidad'); } finally { setBusy(null); }
  }

  async function disposition(hold: Hold) {
    const disp = window.prompt(`Disposición (${DISPS.join('/')}):`, 'USE_AS_IS') as Disp | null;
    if (!disp || !DISPS.includes(disp)) return;
    const signedBy = window.prompt('Firma (nombre del responsable):', '');
    if (!signedBy) return;
    const body: Record<string, unknown> = { disposition: disp, signedBy };
    if (disp === 'USE_AS_IS') { const w = window.prompt('Desviación/waiver:'); if (!w) return; body.waiver = w; }
    if (disp === 'RTV') { const s = window.prompt('SCAR / nota de débito:'); if (!s) return; body.scarRef = s; }
    await act(hold, 'disposition', body);
  }

  async function reinspect(hold: Hold) {
    const pass = window.confirm('¿La re-inspección PASA? (Aceptar = pasa / Cancelar = falla)');
    await act(hold, 'reinspect', { pass });
  }

  async function lookupWhereUsed() {
    if (!wu.trim()) return;
    try {
      const res = await apiFetch(`${API_BASE}/floor-quality/where-used?part=${encodeURIComponent(wu.trim())}`);
      if (!res.ok) { toast.error('No se pudo buscar.', 'Where-used'); return; }
      setWuRows(await res.json());
    } catch { toast.error('Error de red.', 'Where-used'); }
  }

  if (forbidden) {
    return (
      <div className="min-h-screen grid place-items-center text-black dark:text-white">
        <div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}><Lock className="w-8 h-8 mx-auto mb-3 text-gray-400" /><h2 className="text-lg font-semibold">Sin acceso</h2><p className="text-sm text-gray-400 mt-1">Necesitas permiso de calidad.</p></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-black dark:text-white">
      <div className={`${glass} sticky top-0 z-40 px-6 py-4`}>
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <Link href="/dashboard" className="p-2 -ml-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10"><ChevronLeft className="w-5 h-5" /></Link>
          <span className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: 'rgba(239,68,68,0.14)' }}><ShieldX className="w-5 h-5" style={{ color: RED }} /></span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold leading-tight">Calidad de piso · Hold → MRB → Disposición</h1>
            <p className="text-[12px] text-gray-400 leading-tight">Un hold pone el lote en cuarentena y BLOQUEA el consumo y embarque de la WO.</p>
          </div>
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white" style={{ background: RED }}><Plus className="w-4 h-4" /> Nuevo hold</button>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 pt-8 pb-24">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          <Kpi label="Holds abiertos" value={kpis?.openHolds ?? 0} color={RED} />
          <Kpi label="% Use-as-is" value={pct(kpis?.pctUseAsIs ?? 0)} color={AMBER} />
          <Kpi label="Scrap (qty)" value={kpis?.scrapQty ?? 0} color={RED} />
          <Kpi label="Ciclo disp. (d)" value={kpis?.avgDispositionDays ?? 0} color={BLUE} />
          <Kpi label="NCRs vencidas" value={kpis?.overdue ?? 0} color={RED} />
        </div>

        {/* Where-used */}
        <div className={`${glass} rounded-2xl p-4 mb-6`}>
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-gray-400" />
            <input value={wu} onChange={(e) => setWu(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') lookupWhereUsed(); }} placeholder="Contención: ¿dónde se usó este NP? (genealogía)" className="ci-input flex-1" />
            <button onClick={lookupWhereUsed} className="px-3 py-2 rounded-lg text-[13px] font-medium" style={{ background: `${BLUE}1f`, color: BLUE }}>Buscar</button>
          </div>
          {wuRows && (
            <div className="mt-3 text-[12px]">
              {wuRows.length === 0 ? <span className="text-gray-400">Sin consumos registrados de {wu}.</span> : (
                <div className="space-y-1">
                  {wuRows.map((r) => <div key={r.id} className="flex items-center gap-3 text-gray-500"><span className="font-mono">{r.unitSerial || '—'}</span><span>{r.woFolio}</span><span>{r.model} · {r.station}</span><span>{new Date(r.createdAt).toLocaleString()}</span></div>)}
                </div>
              )}
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : holds.length === 0 ? (
          <div className={`${glass} rounded-3xl p-12 text-center`}><Inbox className="w-8 h-8 mx-auto mb-3 text-gray-400" /><h3 className="font-semibold">Sin holds</h3><p className="text-sm text-gray-400 mt-1">Captura un rechazo desde IQC, en-proceso u OQC para iniciar el flujo MRB.</p></div>
        ) : (
          <div className="space-y-8">
            {ORDER.map((status) => {
              const items = holds.filter((h) => h.status === status);
              if (items.length === 0) return null;
              return (
                <section key={status}>
                  <div className="flex items-center gap-2 mb-3"><span className="w-2.5 h-2.5 rounded-full" style={{ background: SMETA[status].color }} /><h2 className="text-sm font-semibold">{SMETA[status].label}</h2><span className="text-[11px] text-gray-400">({items.length})</span></div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {items.map((h) => (
                      <div key={h.id} className={`${glass} rounded-2xl p-4`}>
                        <div className="flex items-center gap-2 flex-wrap">
                          {h.folio && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500">{h.folio}</span>}
                          <span className="font-mono font-semibold">{h.part}</span>
                          <span className="text-[11px] text-gray-400">{h.qty} u</span>
                          {(h.severity === 'HIGH' || h.severity === 'CRITICAL') && <span className="text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-0.5" style={{ background: `${RED}1f`, color: RED }}><AlertTriangle className="w-3 h-3" /> {h.severity}</span>}
                          {h.disposition && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${VIOLET}1f`, color: VIOLET }}>{h.disposition}</span>}
                        </div>
                        <div className="text-[12px] text-gray-400 mt-1">{h.origin}{h.station ? ` · ${h.station}` : ''}{h.woFolio ? ` · ${h.woFolio}` : ''}{h.defectType ? ` · ${h.defectType}` : ''}{h.lot ? ` · lote ${h.lot}` : ''}{h.serial ? ` · SN ${h.serial}` : ''}</div>
                        <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                          {h.status === 'HELD' && <Btn label="A MRB" color={AMBER} onClick={() => act(h, 'mrb')} busy={busy === h.id} />}
                          {h.status === 'MRB_REVIEW' && <Btn label="Disponer" color={VIOLET} onClick={() => disposition(h)} busy={busy === h.id} />}
                          {h.status === 'DISPOSITIONED' && (h.disposition === 'REWORK' || h.disposition === 'REPAIR') && <Btn label="Iniciar retrabajo" color={BLUE} onClick={() => act(h, 'rework')} busy={busy === h.id} />}
                          {h.status === 'DISPOSITIONED' && h.disposition !== 'REWORK' && h.disposition !== 'REPAIR' && <Btn label="Cerrar" color={GREEN} onClick={() => act(h, 'close')} busy={busy === h.id} />}
                          {(h.status === 'REWORK' || h.status === 'REINSPECT') && <Btn label="Re-inspección" color={BLUE} onClick={() => reinspect(h)} busy={busy === h.id} />}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>

      {showForm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setShowForm(false)}>
          <div className={`${glass} rounded-2xl p-5 w-full max-w-xl`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="font-semibold flex items-center gap-2"><FileWarning className="w-4 h-4" style={{ color: RED }} /> Nuevo hold / rechazo</h3><button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button></div>
            <div className="grid grid-cols-2 gap-4">
              <F label="Origen"><select value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} className="ci-input"><option value="IQC">IQC (recibo)</option><option value="IN_PROCESS">En proceso</option><option value="OQC">OQC (salida)</option></select></F>
              <F label="Severidad"><select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} className="ci-input"><option value="LOW">Baja</option><option value="MEDIUM">Media</option><option value="HIGH">Alta</option><option value="CRITICAL">Crítica</option></select></F>
              <F label="NP"><input value={form.part} onChange={(e) => setForm({ ...form, part: e.target.value })} className="ci-input" placeholder="CAP-0402-100NF" /></F>
              <F label="Cantidad"><input type="number" min={0} value={form.qty} onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })} className="ci-input" /></F>
              <F label="Lote"><input value={form.lot} onChange={(e) => setForm({ ...form, lot: e.target.value })} className="ci-input" /></F>
              <F label="Serial"><input value={form.serial} onChange={(e) => setForm({ ...form, serial: e.target.value })} className="ci-input" /></F>
              <F label="WO (id)"><input value={form.woId} onChange={(e) => setForm({ ...form, woId: e.target.value })} className="ci-input" placeholder="(opcional)" /></F>
              <F label="Estación"><input value={form.station} onChange={(e) => setForm({ ...form, station: e.target.value })} className="ci-input" /></F>
              <F label="Tipo de defecto"><input value={form.defectType} onChange={(e) => setForm({ ...form, defectType: e.target.value })} className="ci-input" placeholder="Soldadura fría" /></F>
              <F label="Foto (URL)"><input value={form.photoUrl} onChange={(e) => setForm({ ...form, photoUrl: e.target.value })} className="ci-input" placeholder="https://…" /></F>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
              <button onClick={create} disabled={busy === 'new'} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: RED }}>{busy === 'new' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />} Crear hold</button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .ci-input { width: 100%; border-radius: 0.75rem; padding: 0.55rem 0.75rem; background: rgba(0,0,0,0.03); border: 1px solid rgba(0,0,0,0.08); outline: none; font-size: 0.875rem; }
        .ci-input:focus { border-color: ${RED}; }
        :global(.dark) .ci-input { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.1); }
      `}</style>
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: number | string; color: string }) {
  return <div className={`${glass} rounded-2xl p-4`}><div className="text-[11px] uppercase tracking-wide text-gray-400">{label}</div><div className="text-2xl font-semibold mt-1" style={{ color }}>{value}</div></div>;
}
function Btn({ label, color, onClick, busy }: { label: string; color: string; onClick: () => void; busy: boolean }) {
  return <button onClick={onClick} disabled={busy} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium disabled:opacity-50" style={{ background: `${color}1f`, color }}><ArrowRight className="w-3 h-3" /> {label}</button>;
}
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="block text-[12px] font-medium text-gray-500 mb-1">{label}</span>{children}</label>;
}
