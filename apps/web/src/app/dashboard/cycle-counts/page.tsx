'use client';

import React, { useMemo, useState } from 'react';
import {
  ClipboardList,
  Plus,
  Lock,
  Loader2,
  Inbox,
  X,
  CheckCircle2,
  ArrowRight,
  ListChecks,
  AlertTriangle,
  Search,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

const TEAL = '#16a394';
const GREEN = '#10b981';
const AMBER = '#f59e0b';
const BLUE = '#0a84ff';
const GRAY = '#6b7280';
const RED = '#ef4444';

type Status = 'OPEN' | 'COUNTED' | 'RECONCILED' | 'ADJUSTED' | 'CANCELLED';

interface Count {
  id: string;
  folio: string | null;
  partNumber: string;
  location?: string | null;
  uom: string;
  systemQty: number;
  countedQty: number | null;
  variance: number | null;
  status: Status;
}

interface Kpis {
  total: number;
  open: number;
  inventoryAccuracyPct: number | null;
  countsWithVariance: number;
  totalAbsVariance: number;
  adjustments: number;
}

const STATUS_META: Record<Status, { label: string; color: string }> = {
  OPEN: { label: 'Abierto', color: AMBER },
  COUNTED: { label: 'Contado', color: BLUE },
  RECONCILED: { label: 'Conciliado', color: GREEN },
  ADJUSTED: { label: 'Ajustado', color: GREEN },
  CANCELLED: { label: 'Cancelado', color: GRAY },
};
const ORDER: Status[] = ['OPEN', 'COUNTED', 'ADJUSTED', 'RECONCILED'];

type View = 'flow' | 'discrepancies';

export default function CycleCountsPage() {
  const { data, isLoading, forbidden, mutate } = useApi<Count[]>('/cycle-counts');
  const { data: kpis, mutate: mutateKpis } = useApi<Kpis>('/cycle-counts/kpis');
  const toast = useToast();

  const [view, setView] = useState<View>('flow');
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({ partNumber: '', location: '', systemQty: 0, uom: 'PCS' });
  const [countInputs, setCountInputs] = useState<Record<string, string>>({});
  const [cq, setCq] = useState('');

  const list = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const matchesSearch = (c: Count) =>
    !cq || `${c.partNumber} ${c.folio ?? ''} ${c.location ?? ''}`.toLowerCase().includes(cq.toLowerCase());

  // Discrepancias = conteos ya contados cuya cantidad NO cuadra con el sistema.
  // (ADJUSTED resuelve la varianza a 0 en backend, así que no aparece aquí.)
  const discrepancies = useMemo(
    () =>
      list
        .filter((c) => c.variance !== null && c.variance !== 0)
        .sort((a, b) => Math.abs(Number(b.variance)) - Math.abs(Number(a.variance))),
    [list],
  );
  // Discrepancias visibles tras la búsqueda (y su varianza neta).
  const shownDiscrepancies = discrepancies.filter(matchesSearch);
  const netVariance = shownDiscrepancies.reduce((a, c) => a + Number(c.variance ?? 0), 0);

  function refresh() {
    mutate();
    mutateKpis();
  }

  async function createCount() {
    if (form.partNumber.trim().length < 1) {
      toast.error('Indica el número de parte.', 'Conteos');
      return;
    }
    setBusy('new');
    try {
      const res = await apiFetch(`${API_BASE}/cycle-counts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, location: form.location || undefined }),
      });
      if (!res.ok) { toast.error('No se pudo crear.', 'Conteos'); return; }
      toast.success('Conteo creado.', 'Conteos');
      setShowForm(false);
      setForm({ partNumber: '', location: '', systemQty: 0, uom: 'PCS' });
      refresh();
    } catch {
      toast.error('Error de red.', 'Conteos');
    } finally {
      setBusy(null);
    }
  }

  async function recordCount(c: Count) {
    const raw = countInputs[c.id];
    if (raw === undefined || raw === '') {
      toast.error('Escribe la cantidad contada.', 'Conteos');
      return;
    }
    setBusy(c.id);
    try {
      const res = await apiFetch(`${API_BASE}/cycle-counts/${c.id}/count`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countedQty: Number(raw) }),
      });
      if (!res.ok) { toast.error('No se pudo registrar el conteo.', 'Conteos'); return; }
      toast.success('Conteo registrado.', 'Conteos');
      setCountInputs((s) => ({ ...s, [c.id]: '' }));
      refresh();
    } catch {
      toast.error('Error de red.', 'Conteos');
    } finally {
      setBusy(null);
    }
  }

  async function transition(c: Count, status: Status) {
    setBusy(c.id);
    try {
      const res = await apiFetch(`${API_BASE}/cycle-counts/${c.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) { toast.error('No se pudo actualizar.', 'Conteos'); return; }
      toast.success(`→ ${STATUS_META[status].label}`, 'Conteos');
      refresh();
    } catch {
      toast.error('Error de red.', 'Conteos');
    } finally {
      setBusy(null);
    }
  }

  if (forbidden) {
    return (
      <div className="min-h-screen grid place-items-center text-foreground">
        <div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}>
          <Lock className="w-8 h-8 mx-auto mb-3 text-gray-500 dark:text-gray-400" />
          <h2 className="text-lg font-semibold">Sin acceso</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Inicia sesión para ver conteos.</p>
        </div>
      </div>
    );
  }

  // Acciones por conteo (reutilizadas en Flujo y Discrepancias).
  function rowActions(c: Count) {
    if (c.status === 'OPEN') {
      return (
        <>
          <input
            type="number"
            value={countInputs[c.id] ?? ''}
            onChange={(e) => setCountInputs((s) => ({ ...s, [c.id]: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter') recordCount(c); }}
            placeholder="contado"
            className="cc-input w-24"
          />
          <button onClick={() => recordCount(c)} disabled={busy === c.id} className="px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-white disabled:opacity-50" style={{ background: TEAL }}>
            Contar
          </button>
          <button onClick={() => transition(c, 'CANCELLED')} disabled={busy === c.id} title="Cancelar conteo" className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-red-500 disabled:opacity-50">
            <X className="w-3.5 h-3.5" />
          </button>
        </>
      );
    }
    if (c.status === 'COUNTED') {
      return (
        <>
          <button onClick={() => transition(c, 'RECONCILED')} disabled={busy === c.id} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium disabled:opacity-50" style={{ background: `${GREEN}1f`, color: GREEN }}>
            <ArrowRight className="w-3 h-3" /> Conciliar
          </button>
          <button onClick={() => transition(c, 'ADJUSTED')} disabled={busy === c.id} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium disabled:opacity-50" style={{ background: `${AMBER}1f`, color: AMBER }}>
            <ArrowRight className="w-3 h-3" /> Ajustar
          </button>
        </>
      );
    }
    return null;
  }

  return (
    <div className="min-h-screen text-foreground font-sans pb-32">
      <main className="max-w-7xl mx-auto px-6 pt-10">
        <PageHeader
          domain="inventory"
          icon={ClipboardList}
          title="Conteos Cíclicos"
          subtitle="Exactitud de inventario, varianza y reconciliación"
          right={
            <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white" style={{ background: TEAL }}>
              <Plus className="w-4 h-4" /> Nuevo conteo
            </button>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Kpi label="Exactitud inventario" value={kpis?.inventoryAccuracyPct === null || kpis?.inventoryAccuracyPct === undefined ? '—' : `${kpis.inventoryAccuracyPct}%`} color={(kpis?.inventoryAccuracyPct ?? 100) >= 95 ? GREEN : AMBER} />
          <Kpi label="Conteos abiertos" value={kpis?.open ?? 0} color={AMBER} />
          <Kpi label="Con varianza" value={kpis?.countsWithVariance ?? 0} color={(kpis?.countsWithVariance ?? 0) > 0 ? RED : GREEN} />
          <Kpi label="Ajustes" value={kpis?.adjustments ?? 0} color={TEAL} />
        </div>

        {/* Toggle de vista */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <div className={`${glass} inline-flex items-center gap-1 p-1 rounded-2xl`}>
            <ViewBtn active={view === 'flow'} onClick={() => setView('flow')} icon={<ListChecks className="w-4 h-4" />}>Flujo</ViewBtn>
            <ViewBtn active={view === 'discrepancies'} onClick={() => setView('discrepancies')} icon={<AlertTriangle className="w-4 h-4" />}>
              Discrepancias{discrepancies.length > 0 ? ` (${discrepancies.length})` : ''}
            </ViewBtn>
          </div>
          {list.length > 0 && (
            <div className={`${glass} flex items-center gap-2 px-4 py-2 rounded-2xl flex-1 min-w-[200px]`}>
              <Search className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <input value={cq} onChange={(e) => setCq(e.target.value)} placeholder="Buscar parte, folio o ubicación…" className="bg-transparent outline-none text-sm w-full" />
            </div>
          )}
        </div>

        {showForm && (
          <div className={`${glass} rounded-2xl p-5 mb-6`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Nuevo conteo</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <label className="block md:col-span-2">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">N° de parte</span>
                <input value={form.partNumber} onChange={(e) => setForm({ ...form, partNumber: e.target.value })} placeholder="RES-0402-10K" className="cc-input font-mono" />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Ubicación</span>
                <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="A-12-03" className="cc-input" />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Cant. sistema</span>
                <input type="number" min={0} value={form.systemQty} onChange={(e) => setForm({ ...form, systemQty: Number(e.target.value) })} className="cc-input" />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
              <button onClick={createCount} disabled={busy === 'new'} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: TEAL }}>
                {busy === 'new' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Crear
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-500 dark:text-gray-400" /></div>
        ) : list.length === 0 ? (
          <div className={`${glass} rounded-3xl p-12 text-center`}>
            <Inbox className="w-8 h-8 mx-auto mb-3 text-gray-500 dark:text-gray-400" />
            <h3 className="font-semibold">Sin conteos</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Crea un conteo para medir la exactitud de inventario.</p>
          </div>
        ) : view === 'discrepancies' ? (
          shownDiscrepancies.length === 0 ? (
            <div className={`${glass} rounded-3xl p-12 text-center`}>
              <CheckCircle2 className="w-8 h-8 mx-auto mb-3" style={{ color: GREEN }} />
              <h3 className="font-semibold">{cq ? 'Sin coincidencias' : 'Sin discrepancias'}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{cq ? 'Ningún conteo con diferencia coincide con la búsqueda.' : 'Todos los conteos registrados cuadran con el sistema.'}</p>
            </div>
          ) : (
            <>
              <p className="text-[12px] text-gray-500 dark:text-gray-400 mb-3">
                {shownDiscrepancies.length} parte{shownDiscrepancies.length === 1 ? '' : 's'} con diferencia · varianza neta{' '}
                <span className="font-semibold" style={{ color: netVariance === 0 ? GRAY : netVariance > 0 ? GREEN : RED }}>
                  {netVariance > 0 ? '+' : ''}{netVariance}
                </span>
              </p>
              <div className="space-y-3">
                {shownDiscrepancies.map((c) => {
                  const v = Number(c.variance);
                  const over = v > 0;
                  return (
                    <div key={c.id} className={`${glass} rounded-2xl p-4`}>
                      <div className="flex items-start gap-3 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {c.folio && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500">{c.folio}</span>}
                            <span className="font-semibold font-mono truncate">{c.partNumber}</span>
                            {c.location && <span className="text-[11px] text-gray-500 dark:text-gray-400">{c.location}</span>}
                            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${STATUS_META[c.status].color}1f`, color: STATUS_META[c.status].color }}>{STATUS_META[c.status].label}</span>
                          </div>
                          <div className="mt-1 text-[12px] text-gray-500 dark:text-gray-400">
                            sistema {c.systemQty} {c.uom} · contado {c.countedQty} {c.uom}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-lg font-bold tabular-nums" style={{ color: over ? GREEN : RED }}>
                            {over ? '+' : ''}{v} {c.uom}
                          </div>
                          <div className="text-[10px] text-gray-500 dark:text-gray-400">{over ? 'sobrante' : 'faltante'}</div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 w-full justify-end">{rowActions(c)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )
        ) : (
          <div className="space-y-8">
            {ORDER.map((status) => {
              const items = list.filter((c) => c.status === status && matchesSearch(c));
              if (items.length === 0) return null;
              return (
                <section key={status}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_META[status].color }} />
                    <h2 className="text-sm font-semibold">{STATUS_META[status].label}</h2>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">({items.length})</span>
                  </div>
                  <div className="space-y-3">
                    {items.map((c) => (
                      <div key={c.id} className={`${glass} rounded-2xl p-4`}>
                        <div className="flex items-start gap-3 flex-wrap">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {c.folio && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500">{c.folio}</span>}
                              <span className="font-semibold font-mono truncate">{c.partNumber}</span>
                              {c.location && <span className="text-[11px] text-gray-500 dark:text-gray-400">{c.location}</span>}
                              {c.variance !== null && c.variance !== 0 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${RED}1f`, color: RED }}>
                                  var {c.variance > 0 ? '+' : ''}{c.variance}
                                </span>
                              )}
                              {c.variance === 0 && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${GREEN}1f`, color: GREEN }}>exacto</span>}
                            </div>
                            <div className="mt-1 text-[12px] text-gray-500 dark:text-gray-400">
                              sistema {c.systemQty} {c.uom}{c.countedQty !== null && <> · contado {c.countedQty} {c.uom}</>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">{rowActions(c)}</div>
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

      <style jsx global>{`
        .cc-input {
          border-radius: 0.75rem;
          padding: 0.55rem 0.75rem;
          background: rgba(0, 0, 0, 0.03);
          border: 1px solid rgba(0, 0, 0, 0.08);
          outline: none;
          font-size: 0.875rem;
          width: 100%;
        }
        .cc-input:focus { border-color: ${TEAL}; }
        :global(.dark) .cc-input {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </div>
  );
}

function ViewBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-sm font-medium transition-colors ${
        active ? 'bg-white text-black shadow-sm dark:bg-white/15 dark:text-white' : 'text-gray-500 hover:text-foreground'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function Kpi({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className={`${glass} rounded-2xl p-4`}>
      <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
      <div className="text-2xl font-semibold mt-1" style={{ color }}>{value}</div>
    </div>
  );
}
