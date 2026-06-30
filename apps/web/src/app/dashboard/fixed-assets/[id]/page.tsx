'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ChevronLeft, Loader2, Lock, X, CheckCircle2, Building, Wallet, ShieldHalf,
  CalendarClock, TrendingDown, BookOpen, Percent, Archive, Ban, Activity,
  MapPin, FileText, Layers, CalendarDays, Coins,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

// Finance domain accent (teal) — matches the list view.
const TEAL = '#0fb39a';
const GREEN = '#10b981';
const AMBER = '#f59e0b';
const GRAY = '#6b7280';
const RED = '#ef4444';

type Status = 'IN_SERVICE' | 'DISPOSED';

interface Asset {
  id: string;
  folio: string | null;
  name: string;
  category: string | null;
  acquisitionCost: number;
  salvageValue: number;
  usefulLifeMonths: number;
  currency: string;
  method: string;
  status: Status;
  location: string | null;
  programId: string | null;
  acquisitionDate: string | null;
  disposedAt: string | null;
  monthlyDepreciation: number;
  accumulatedDepreciation: number;
  bookValue: number;
}

const faInput =
  'w-full rounded-xl px-3 py-2 text-sm bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/10 outline-none focus:border-teal-500';

// ── Module-level helpers (no Date.now() inside render bodies) ─────────────────
function nowMs(): number {
  return Date.now();
}
function money(n: number, ccy: string): string {
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: ccy || 'USD', maximumFractionDigits: 0 }).format(n || 0);
  } catch {
    return `${Math.round(n || 0).toLocaleString()} ${ccy}`;
  }
}
function money2(n: number, ccy: string): string {
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: ccy || 'USD', maximumFractionDigits: 0 }).format(Math.round(n || 0));
  } catch {
    return `${Math.round(n || 0).toLocaleString()} ${ccy}`;
  }
}
function fmtDate(d: string | null): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}
function todayInput(): string {
  return new Date(nowMs()).toISOString().slice(0, 10);
}

/** Whole months elapsed between two dates, floored, never negative. Mirrors the backend `monthsBetween`. */
function monthsBetween(from: string | null, toMs: number): number {
  if (!from) return 0;
  const f = new Date(from);
  if (Number.isNaN(f.getTime())) return 0;
  const to = new Date(toMs);
  let months = (to.getFullYear() - f.getFullYear()) * 12 + (to.getMonth() - f.getMonth());
  if (to.getDate() < f.getDate()) months -= 1;
  return Math.max(0, months);
}

interface Period {
  index: number;       // 1-based month number
  date: Date;          // start of the depreciation period
  year: number;
  depreciation: number;
  accumulated: number;
  bookValue: number;
}

interface Schedule {
  rows: Period[];
  byYear: { year: number; rows: Period[]; depreciation: number; endBookValue: number }[];
  perMonth: number;
  elapsedMonths: number;   // months consumed since acquisition (capped at life)
  currentIndex: number;    // 1-based current period, 0 if not started/over
}

/**
 * Straight-line schedule, computed client-side:
 *   monthlyDepreciation = (acquisitionCost − salvageValue) / usefulLifeMonths
 * Accumulated is capped at the depreciable base; book value floors at salvage.
 * "now" comes from the module-level nowMs() helper (passed in), never Date.now()
 * read inside a render body.
 */
function buildSchedule(a: Asset, nowMillis: number): Schedule {
  const life = Math.max(0, Math.floor(Number(a.usefulLifeMonths) || 0));
  const base = Math.max(0, Number(a.acquisitionCost || 0) - Number(a.salvageValue || 0));
  const perMonth = life > 0 ? base / life : 0;
  const start = a.acquisitionDate ? new Date(a.acquisitionDate) : null;

  // A disposed asset stops accruing at its disposal date.
  const asOfMs = a.status === 'DISPOSED' && a.disposedAt ? new Date(a.disposedAt).getTime() : nowMillis;
  const elapsedMonths = Math.min(life, monthsBetween(a.acquisitionDate, asOfMs));

  const rows: Period[] = [];
  let accumulated = 0;
  for (let i = 1; i <= life; i++) {
    accumulated = Math.min(base, perMonth * i);
    const date = start ? new Date(start.getFullYear(), start.getMonth() + (i - 1), 1) : new Date(0);
    rows.push({
      index: i,
      date,
      year: start ? date.getFullYear() : i,
      depreciation: perMonth,
      accumulated,
      bookValue: Number(a.acquisitionCost || 0) - accumulated,
    });
  }

  const byYearMap = new Map<number, Period[]>();
  for (const r of rows) {
    const arr = byYearMap.get(r.year);
    if (arr) arr.push(r);
    else byYearMap.set(r.year, [r]);
  }
  const byYear = Array.from(byYearMap.entries()).map(([year, yrRows]) => ({
    year,
    rows: yrRows,
    depreciation: yrRows.reduce((s, r) => s + r.depreciation, 0),
    endBookValue: yrRows[yrRows.length - 1].bookValue,
  }));

  // Current period = the month being depreciated now (1-based). 0 once fully done.
  const currentIndex = a.status === 'DISPOSED' ? 0 : Math.min(life, elapsedMonths + 1) <= life && elapsedMonths < life ? elapsedMonths + 1 : 0;

  return { rows, byYear, perMonth, elapsedMonths, currentIndex };
}

export default function FixedAssetDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const { data: a, isLoading, forbidden, mutate } = useApi<Asset>(`/fixed-assets/${id}`);
  const [modal, setModal] = useState<null | 'dispose'>(null);

  // Compute "now" once per render via the module helper (not Date.now() inline).
  const nowMillis = nowMs();
  const schedule = useMemo(() => (a ? buildSchedule(a, nowMillis) : null), [a, nowMillis]);

  if (forbidden) return <Guard />;
  if (isLoading || !a || !schedule) {
    return <div className="min-h-screen grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-gray-500 dark:text-gray-400" /></div>;
  }

  const isDisposed = a.status === 'DISPOSED';
  const pctDepreciated = a.acquisitionCost > 0 ? Math.min(100, Math.round((a.accumulatedDepreciation / a.acquisitionCost) * 100)) : 0;
  const lifePct = a.usefulLifeMonths > 0 ? Math.min(100, Math.round((schedule.elapsedMonths / a.usefulLifeMonths) * 100)) : 0;

  return (
    <div className="min-h-screen text-foreground">
      {/* Sticky glass header */}
      <div className={`${glass} sticky top-0 z-40 px-6 py-4`}>
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Link href="/dashboard/fixed-assets" aria-label="Volver" className="p-2 -ml-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10"><ChevronLeft className="w-5 h-5" /></Link>
          <span className="w-10 h-10 rounded-xl grid place-items-center flex-shrink-0" style={{ background: `${TEAL}1f` }}>
            <Building className="w-5 h-5" style={{ color: TEAL }} />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold leading-tight truncate">{a.name}</h1>
            <p className="text-[12px] text-gray-500 dark:text-gray-400 leading-tight font-mono">{a.folio || 'Sin folio'}{a.location ? ` · ${a.location}` : ''}</p>
          </div>
          {a.category && <span className="hidden sm:inline text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: `${TEAL}14`, color: TEAL }}>{a.category}</span>}
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: `${isDisposed ? GRAY : GREEN}1f`, color: isDisposed ? GRAY : GREEN }}>
            {isDisposed ? 'Dado de baja' : 'En servicio'}
          </span>
          {!isDisposed && (
            <button onClick={() => setModal('dispose')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-medium text-gray-500 hover:bg-black/5 dark:hover:bg-white/10" title="Dar de baja">
              <Archive className="w-4 h-4" /> <span className="hidden sm:inline">Baja</span>
            </button>
          )}
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 pt-6 pb-24">
        {/* Disposal banner */}
        {isDisposed && (
          <div className="rounded-2xl px-4 py-3 mb-6 flex items-start gap-3" style={{ background: `${GRAY}14`, border: `1px solid ${GRAY}33` }}>
            <Ban className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: GRAY }} />
            <div className="min-w-0">
              <div className="text-sm font-semibold" style={{ color: GRAY }}>Activo dado de baja</div>
              <div className="text-[13px] text-gray-500 mt-0.5">
                Dado de baja el {fmtDate(a.disposedAt)}. La depreciación se detuvo en esa fecha; el valor en libros contable quedó en 0.
              </div>
            </div>
          </div>
        )}

        {/* Metric strip */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <Metric icon={Wallet} label="Costo adquisición" value={money(a.acquisitionCost, a.currency)} color={TEAL} />
          <Metric icon={ShieldHalf} label="Valor de rescate" value={money(a.salvageValue, a.currency)} color={GRAY} />
          <Metric icon={CalendarClock} label="Vida útil" value={`${a.usefulLifeMonths} m`} color={GRAY} />
          <Metric icon={BookOpen} label="Valor en libros" value={money(a.bookValue, a.currency)} color={GREEN} />
          <Metric icon={TrendingDown} label="Depreciación acum." value={money(a.accumulatedDepreciation, a.currency)} color={AMBER} />
          <Metric icon={Percent} label="Depreciado" value={`${pctDepreciated}%`} color={pctDepreciated >= 100 ? AMBER : TEAL} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* HERO: depreciation schedule */}
          <div className="lg:col-span-2 space-y-6">
            <ScheduleCard asset={a} schedule={schedule} lifePct={lifePct} />
          </div>

          {/* Right rail: asset detail */}
          <div className="space-y-6">
            <div className={`${glass} rounded-2xl p-5`}>
              <h3 className="text-sm font-semibold mb-4">Datos del activo</h3>
              <div className="space-y-3">
                <Row icon={FileText} label="Folio" value={a.folio || '—'} mono />
                <Row icon={Layers} label="Categoría" value={a.category || '—'} />
                <Row icon={Activity} label="Método" value={a.method === 'STRAIGHT_LINE' ? 'Línea recta' : a.method} />
                <Row icon={Coins} label="Moneda" value={a.currency} />
                <Row icon={MapPin} label="Ubicación" value={a.location || '—'} />
                <Row icon={CalendarDays} label="Adquisición" value={fmtDate(a.acquisitionDate)} />
                <Row icon={CalendarClock} label="Depreciación mensual" value={money2(schedule.perMonth, a.currency)} />
                {isDisposed && <Row icon={Ban} label="Baja" value={fmtDate(a.disposedAt)} />}
              </div>
            </div>

            <div className={`${glass} rounded-2xl p-5`}>
              <h3 className="text-sm font-semibold mb-3">Resumen</h3>
              <SummaryBar label="Vida útil consumida" value={lifePct} color={TEAL} detail={`${schedule.elapsedMonths} / ${a.usefulLifeMonths} meses`} />
              <SummaryBar label="Costo depreciado" value={pctDepreciated} color={AMBER} detail={`${money(a.accumulatedDepreciation, a.currency)} de ${money(a.acquisitionCost - a.salvageValue, a.currency)}`} />
            </div>
          </div>
        </div>
      </main>

      {modal === 'dispose' && !isDisposed && (
        <DisposeModal asset={a} onClose={() => setModal(null)} onDone={() => { setModal(null); mutate(); }} />
      )}
    </div>
  );
}

// ── HERO: depreciation schedule (grouped by year, current period highlighted) ──
function ScheduleCard({ asset, schedule, lifePct }: { asset: Asset; schedule: Schedule; lifePct: number }) {
  const ccy = asset.currency;
  if (schedule.rows.length === 0) {
    return (
      <div className={`${glass} rounded-2xl p-5`}>
        <h3 className="text-sm font-semibold mb-2">Calendario de depreciación</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">Sin vida útil o base depreciable — no hay calendario que calcular.</p>
      </div>
    );
  }
  return (
    <div className={`${glass} rounded-2xl p-5`}>
      <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
        <h3 className="text-sm font-semibold flex items-center gap-2"><TrendingDown className="w-4 h-4" style={{ color: TEAL }} /> Calendario de depreciación</h3>
        <span className="text-[12px] text-gray-500 dark:text-gray-400">línea recta · {money2(schedule.perMonth, ccy)}/mes</span>
      </div>
      <p className="text-[12px] text-gray-500 dark:text-gray-400 mb-3">
        (costo − rescate) ÷ vida útil = ({money(asset.acquisitionCost, ccy)} − {money(asset.salvageValue, ccy)}) ÷ {asset.usefulLifeMonths} m
      </p>

      {/* Useful-life progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-[12px] mb-1">
          <span className="text-gray-500">Vida útil consumida</span>
          <span className="font-medium tabular-nums">{lifePct}% · {schedule.elapsedMonths}/{asset.usefulLifeMonths} m</span>
        </div>
        <div className="h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${lifePct}%`, background: TEAL }} />
        </div>
      </div>

      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-black/5 dark:border-white/10">
              <th className="text-left font-medium px-2 py-2">Periodo</th>
              <th className="text-right font-medium px-2 py-2">Depreciación</th>
              <th className="text-right font-medium px-2 py-2">Acumulada</th>
              <th className="text-right font-medium px-2 py-2">Valor en libros</th>
            </tr>
          </thead>
          <tbody>
            {schedule.byYear.map((yr) => {
              const hasCurrent = yr.rows.some((r) => r.index === schedule.currentIndex);
              return (
                <React.Fragment key={yr.year}>
                  {/* Year subtotal header */}
                  <tr className="border-b border-black/[0.04] dark:border-white/[0.05] bg-black/[0.015] dark:bg-white/[0.02]">
                    <td className="px-2 py-1.5 font-semibold flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                      {asset.acquisitionDate ? yr.year : `Año ${yr.year}`}
                      {hasCurrent && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: `${TEAL}1f`, color: TEAL }}>actual</span>}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-gray-500 dark:text-gray-400">{money2(yr.depreciation, ccy)}</td>
                    <td className="px-2 py-1.5" />
                    <td className="px-2 py-1.5 text-right tabular-nums font-medium">{money2(yr.endBookValue, ccy)}</td>
                  </tr>
                  {yr.rows.map((r) => {
                    const isCurrent = r.index === schedule.currentIndex;
                    const isPast = schedule.currentIndex !== 0 && r.index < schedule.currentIndex;
                    return (
                      <tr
                        key={r.index}
                        className="border-b border-black/[0.03] dark:border-white/[0.04]"
                        style={isCurrent ? { background: `${TEAL}14` } : undefined}
                      >
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 ${isCurrent ? 'font-semibold' : isPast ? 'text-gray-500 dark:text-gray-400' : ''}`} style={isCurrent ? { color: TEAL } : undefined}>
                            {isCurrent && <span className="w-1.5 h-1.5 rounded-full" style={{ background: TEAL }} />}
                            <span className="text-gray-500 dark:text-gray-400 tabular-nums">{r.index}.</span>
                            {asset.acquisitionDate ? r.date.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' }) : `Mes ${r.index}`}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{money2(r.depreciation, ccy)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-gray-500">{money2(r.accumulated, ccy)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-medium" style={{ color: isCurrent ? TEAL : undefined }}>{money2(r.bookValue, ccy)}</td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-black/10 dark:border-white/10 text-[12px]">
              <td className="px-2 py-2 font-semibold">Total depreciable</td>
              <td className="px-2 py-2 text-right tabular-nums font-semibold">{money2(asset.acquisitionCost - asset.salvageValue, ccy)}</td>
              <td className="px-2 py-2" />
              <td className="px-2 py-2 text-right tabular-nums font-semibold">{money2(asset.salvageValue, ccy)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-3">El valor en libros desciende del costo de adquisición hasta el valor de rescate al término de la vida útil.</p>
    </div>
  );
}

// ── Dispose modal (date + proceeds; backend persists the disposal date) ───────
function DisposeModal({ asset, onClose, onDone }: { asset: Asset; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [disposedAt, setDisposedAt] = useState(todayInput());
  const [proceeds, setProceeds] = useState(0);

  // Indicative gain/loss preview against current book value (display only).
  const gainLoss = proceeds - asset.bookValue;

  async function submit() {
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/fixed-assets/${asset.id}/dispose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // The backend DisposeFixedAssetDto accepts only `disposedAt`.
        body: JSON.stringify({ disposedAt: disposedAt || undefined }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || 'No se pudo dar de baja.', 'Activos');
        return;
      }
      toast.success('Activo dado de baja.', 'Activos');
      onDone();
    } catch {
      toast.error('Error de red.', 'Activos');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Dar de baja activo" onClose={onClose}>
      <p className="text-[13px] text-gray-500 mb-4">
        Detén la depreciación de <span className="font-medium text-foreground">{asset.name}</span> a partir de la fecha de baja. Valor en libros actual: <span className="font-medium">{money(asset.bookValue, asset.currency)}</span>.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Fecha de baja"><input type="date" className={faInput} value={disposedAt} onChange={(e) => setDisposedAt(e.target.value)} /></Field>
        <Field label={`Producto de la venta (${asset.currency})`}><input type="number" min={0} className={faInput} value={proceeds} onChange={(e) => setProceeds(Number(e.target.value))} /></Field>
      </div>
      {proceeds > 0 && (
        <div className="mt-3 text-[12px] rounded-xl px-3 py-2 flex items-center justify-between" style={{ background: `${gainLoss >= 0 ? GREEN : RED}14`, color: gainLoss >= 0 ? GREEN : RED }}>
          <span>{gainLoss >= 0 ? 'Ganancia estimada en disposición' : 'Pérdida estimada en disposición'}</span>
          <span className="font-semibold tabular-nums">{money(Math.abs(gainLoss), asset.currency)}</span>
        </div>
      )}
      <ModalActions busy={busy} onClose={onClose} onSubmit={submit} label="Dar de baja" danger />
    </Modal>
  );
}

// ── Shared bits ───────────────────────────────────────────────────────────────
function Metric({ icon: Icon, label, value, color }: { icon: typeof Building; label: string; value: string; color: string }) {
  return (
    <div className={`${glass} rounded-2xl p-3.5`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
        <Icon className="w-3 h-3" />{label}
      </div>
      <div className="text-sm font-semibold mt-1 tabular-nums truncate" style={{ color }} title={value}>{value}</div>
    </div>
  );
}
function Row({ icon: Icon, label, value, mono }: { icon: typeof Building; label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
      <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
        <span className="text-[12px] text-gray-500 dark:text-gray-400">{label}</span>
        <span className={`text-[13px] font-medium truncate text-right ${mono ? 'font-mono' : ''}`}>{value}</span>
      </div>
    </div>
  );
}
function SummaryBar({ label, value, color, detail }: { label: string; value: number; color: string; detail: string }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center justify-between text-[12px] mb-1"><span className="text-gray-500">{label}</span><span className="font-medium tabular-nums">{value}%</span></div>
      <div className="h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(100, value)}%`, background: color }} /></div>
      <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">{detail}</div>
    </div>
  );
}
function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <label className={`block ${full ? 'sm:col-span-full' : ''}`}><span className="block text-[12px] font-medium text-gray-500 mb-1">{label}</span>{children}</label>;
}
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-16 bg-black/40 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className={`${glass} rounded-3xl p-6 w-full max-w-xl`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h3 className="text-lg font-semibold">{title}</h3><button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button></div>
        {children}
      </div>
    </div>
  );
}
function ModalActions({ busy, onClose, onSubmit, label, danger }: { busy: boolean; onClose: () => void; onSubmit: () => void; label?: string; danger?: boolean }) {
  return (
    <div className="mt-6 flex justify-end gap-2">
      <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
      <button onClick={onSubmit} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: danger ? RED : '#0f766e' }}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} {label || 'Guardar'}</button>
    </div>
  );
}
function Guard() {
  return (
    <div className="min-h-screen grid place-items-center text-foreground">
      <div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}><Lock className="w-8 h-8 mx-auto mb-3 text-gray-500 dark:text-gray-400" /><h2 className="text-lg font-semibold">Sin acceso</h2><p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Inicia sesión para ver el activo.</p></div>
    </div>
  );
}
