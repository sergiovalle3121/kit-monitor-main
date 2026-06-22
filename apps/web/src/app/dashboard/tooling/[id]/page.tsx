'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ChevronLeft,
  Loader2,
  Lock,
  X,
  CheckCircle2,
  Hammer,
  Gauge,
  Wrench,
  Activity,
  MapPin,
  Layers,
  Cpu,
  Plus,
  ArrowRight,
  AlertTriangle,
  ShieldCheck,
  CircleSlash,
  TrendingDown,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

const INDIGO = '#5b63e0';
const GREEN = '#10b981';
const AMBER = '#f59e0b';
const BLUE = '#3b82f6';
const GRAY = '#6b7280';
const RED = '#ef4444';

type ToolStatus = 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE' | 'RETIRED';
type ToolType = 'MOLD' | 'FIXTURE' | 'STENCIL' | 'GAUGE' | 'OTHER';

interface Tool {
  id: string;
  folio: string | null;
  name: string;
  type: ToolType;
  cavities: number;
  lifeShots: number;
  shotsUsed: number;
  status: ToolStatus;
  location?: string | null;
  programId?: string | null;
  lifePercent: number;
  remainingShots: number;
  nearEol: boolean;
}

const STATUS_META: Record<ToolStatus, { label: string; color: string }> = {
  AVAILABLE: { label: 'Disponible', color: GREEN },
  IN_USE: { label: 'En uso', color: BLUE },
  MAINTENANCE: { label: 'Mantenimiento', color: AMBER },
  RETIRED: { label: 'Retirado', color: GRAY },
};
const TYPE_LABEL: Record<ToolType, string> = { MOLD: 'Molde', FIXTURE: 'Fixture', STENCIL: 'Stencil', GAUGE: 'Galga', OTHER: 'Otro' };
const STATUSES: ToolStatus[] = ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'RETIRED'];

// Preventive-maintenance cadence used for the CLIENT-SIDE projection: a PM is
// expected every 25% of rated life. This is an approximation (the backend does
// not track real PM events yet) — the UI labels it explicitly as a projection.
const PM_INTERVAL_PCT = 25;

const tlInput =
  'w-full rounded-xl px-3 py-2.5 text-sm bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/10 outline-none focus:border-[#5b63e0] transition-colors';

/** Life-gauge color band: green <70%, amber 70–90%, red >90% / beyond life. */
function lifeColor(pct: number): string {
  if (pct > 90) return RED;
  if (pct >= 70) return AMBER;
  return GREEN;
}

type PmState = 'overdue' | 'due-soon' | 'ok';

/**
 * Projects the preventive-maintenance status purely from shotsUsed by assuming
 * a PM every PM_INTERVAL_PCT of rated life. `sincePct` is how far we are into
 * the current PM window; once it crosses the interval a PM is "vencido".
 */
function pmProjection(shotsUsed: number, lifeShots: number): {
  state: PmState;
  intervalShots: number;
  sinceShots: number;
  untilShots: number;
} {
  const life = Math.max(0, Number(lifeShots) || 0);
  const used = Math.max(0, Number(shotsUsed) || 0);
  const intervalShots = Math.max(1, Math.round((life * PM_INTERVAL_PCT) / 100));
  const sinceShots = life > 0 ? used % intervalShots : 0;
  const untilShots = Math.max(0, intervalShots - sinceShots);
  const sincePct = intervalShots > 0 ? (sinceShots / intervalShots) * 100 : 0;
  let state: PmState = 'ok';
  if (life > 0) {
    if (sincePct >= 90) state = 'overdue';
    else if (sincePct >= 70) state = 'due-soon';
  }
  return { state, intervalShots, sinceShots, untilShots };
}

const PM_META: Record<PmState, { label: string; color: string; icon: typeof ShieldCheck }> = {
  overdue: { label: 'Vencido', color: RED, icon: AlertTriangle },
  'due-soon': { label: 'Próximo', color: AMBER, icon: Wrench },
  ok: { label: 'Al día', color: GREEN, icon: ShieldCheck },
};

export default function ToolDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const toast = useToast();
  const { data, isLoading, forbidden, mutate } = useApi<Tool>(`/tooling/${id}`);

  const [busy, setBusy] = useState<string | null>(null);
  const [usageOpen, setUsageOpen] = useState(false);

  if (forbidden) return <Guard />;
  if (isLoading) {
    return <div className="min-h-screen grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }
  if (!data) {
    return (
      <div className="min-h-screen grid place-items-center text-black dark:text-white">
        <div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}>
          <Hammer className="w-8 h-8 mx-auto mb-3 text-gray-400" />
          <h2 className="text-lg font-semibold">Herramental no encontrado</h2>
          <p className="text-sm text-gray-400 mt-1">Pudo haber sido eliminado o el folio no existe.</p>
          <Link href="/dashboard/tooling" className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: INDIGO }}>
            <ChevronLeft className="w-4 h-4" /> Volver a herramentales
          </Link>
        </div>
      </div>
    );
  }

  const t = data;
  const sm = STATUS_META[t.status];
  const pct = t.lifePercent;
  const barColor = lifeColor(pct);
  const overLife = t.shotsUsed >= t.lifeShots && t.lifeShots > 0;
  const remainingPct = Math.max(0, Math.round((100 - pct) * 10) / 10);
  const pm = pmProjection(t.shotsUsed, t.lifeShots);
  const pmMeta = PM_META[pm.state];
  const retired = t.status === 'RETIRED';

  async function setStatus(to: ToolStatus) {
    if (to === t.status) return;
    if (to === 'RETIRED' && !window.confirm('¿Retirar este herramental? Saldrá de la flota activa.')) return;
    setBusy(`status-${to}`);
    try {
      const res = await apiFetch(`${API_BASE}/tooling/${t.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: to }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || 'No se pudo actualizar el estado.', 'Tooling');
        return;
      }
      toast.success(`→ ${STATUS_META[to].label}`, 'Tooling');
      mutate();
    } catch {
      toast.error('Error de red.', 'Tooling');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen text-black dark:text-white">
      {/* Sticky header */}
      <div className={`${glass} sticky top-0 z-40 px-6 py-4`}>
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Link href="/dashboard/tooling" className="p-2 -ml-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10"><ChevronLeft className="w-5 h-5" /></Link>
          <span className="w-10 h-10 rounded-xl grid place-items-center flex-shrink-0" style={{ background: `${INDIGO}1f` }}>
            <Hammer className="w-5 h-5" style={{ color: INDIGO }} />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold leading-tight truncate">{t.name}</h1>
            <div className="flex items-center gap-2 text-[12px] text-gray-400 leading-tight flex-wrap">
              {t.folio && <span className="font-mono">{t.folio}</span>}
              <span>·</span><span>{TYPE_LABEL[t.type]}</span>
            </div>
          </div>
          <span className="hidden sm:inline text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: `${INDIGO}1f`, color: INDIGO }}>{TYPE_LABEL[t.type]}</span>
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: `${sm.color}1a`, color: sm.color }}>{sm.label}</span>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 pt-6 pb-24">
        {/* End-of-life / over-life banner */}
        {overLife ? (
          <div className="mb-5 flex items-start gap-3 rounded-2xl px-4 py-3 text-[13px]" style={{ background: `${RED}12`, color: RED }}>
            <CircleSlash className="w-5 h-5 flex-shrink-0 mt-px" />
            <div><span className="font-semibold">Vida nominal agotada.</span> El herramental superó sus {t.lifeShots.toLocaleString()} disparos de vida — evalúa retiro o refacción.</div>
          </div>
        ) : t.nearEol && !retired ? (
          <div className="mb-5 flex items-start gap-3 rounded-2xl px-4 py-3 text-[13px]" style={{ background: `${AMBER}14`, color: '#b45309' }}>
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-px" style={{ color: AMBER }} />
            <div><span className="font-semibold">Próximo a fin de vida (EOL).</span> Por encima del 80% de la vida nominal — planifica reemplazo.</div>
          </div>
        ) : null}
        {retired && (
          <div className="mb-5 flex items-center gap-3 rounded-2xl px-4 py-3 text-[13px]" style={{ background: `${GRAY}14`, color: GRAY }}>
            <CircleSlash className="w-5 h-5 flex-shrink-0" /> Herramental retirado — fuera de la flota activa.
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left / hero column */}
          <div className="lg:col-span-2 space-y-6">
            {/* HERO — life-in-shots gauge */}
            <div className={`${glass} rounded-2xl p-6`}>
              <div className="flex items-center gap-2 mb-5">
                <Gauge className="w-4 h-4" style={{ color: INDIGO }} />
                <h3 className="text-sm font-semibold">Vida en disparos</h3>
              </div>

              <div className="flex items-end justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-end gap-2">
                    <span className="text-5xl font-bold tabular-nums leading-none" style={{ color: barColor }}>{pct}</span>
                    <span className="text-2xl font-semibold mb-0.5" style={{ color: barColor }}>%</span>
                  </div>
                  <div className="text-[12px] text-gray-400 mt-1">vida consumida</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-semibold tabular-nums" style={{ color: barColor }}>{remainingPct}%</div>
                  <div className="text-[12px] text-gray-400">vida restante</div>
                </div>
              </div>

              {/* The bar */}
              <div className="mt-5 h-3 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, background: barColor }} />
              </div>
              <div className="mt-2 flex items-center justify-between text-[12px] text-gray-400 tabular-nums">
                <span>{t.shotsUsed.toLocaleString()} disparos usados</span>
                <span>{t.lifeShots.toLocaleString()} de vida</span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl px-4 py-3" style={{ background: `${barColor}10` }}>
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-gray-400"><TrendingDown className="w-3 h-3" /> Disparos restantes</div>
                  <div className="text-xl font-semibold tabular-nums mt-0.5" style={{ color: barColor }}>{t.remainingShots.toLocaleString()}</div>
                </div>
                <div className="rounded-xl px-4 py-3 bg-black/[0.03] dark:bg-white/[0.05]">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-gray-400"><Layers className="w-3 h-3" /> Cavidades</div>
                  <div className="text-xl font-semibold tabular-nums mt-0.5">{t.cavities}</div>
                </div>
              </div>
            </div>

            {/* PM / maintenance projection */}
            <div className={`${glass} rounded-2xl p-5`}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4" style={{ color: INDIGO }} />
                  <h3 className="text-sm font-semibold">Mantenimiento preventivo</h3>
                </div>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: `${pmMeta.color}1a`, color: pmMeta.color }}>
                  <pmMeta.icon className="w-3.5 h-3.5" /> {pmMeta.label}
                </span>
              </div>
              <p className="text-[12px] text-gray-400 mb-4">
                Proyección cada {PM_INTERVAL_PCT}% de la vida (~{pm.intervalShots.toLocaleString()} disparos). Es una estimación a partir de los disparos acumulados, no de eventos reales de PM.
              </p>
              <div className="h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, (pm.sinceShots / pm.intervalShots) * 100)}%`, background: pmMeta.color }} />
              </div>
              <div className="mt-2 flex items-center justify-between text-[12px] text-gray-400 tabular-nums">
                <span>{pm.sinceShots.toLocaleString()} desde el último PM (proy.)</span>
                <span>{pm.untilShots.toLocaleString()} para el próximo</span>
              </div>
            </div>
          </div>

          {/* Right column — actions + detail */}
          <div className="space-y-6">
            {/* Actions */}
            <div className={`${glass} rounded-2xl p-5`}>
              <h3 className="text-sm font-semibold mb-4">Acciones</h3>

              <button
                onClick={() => setUsageOpen(true)}
                disabled={retired}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                style={{ background: INDIGO }}
              >
                <Plus className="w-4 h-4" /> Registrar disparos
              </button>
              {retired && <p className="mt-2 text-[11px] text-gray-400">Reactiva el herramental para registrar uso.</p>}

              <div className="mt-5">
                <span className="text-[11px] uppercase tracking-wide text-gray-400">Cambiar estado</span>
                <div className="mt-2 flex flex-col gap-2">
                  {STATUSES.filter((s) => s !== t.status).map((to) => {
                    const m = STATUS_META[to];
                    const danger = to === 'RETIRED';
                    return (
                      <button
                        key={to}
                        onClick={() => setStatus(to)}
                        disabled={busy !== null}
                        className="inline-flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
                        style={{ background: `${m.color}14`, color: m.color }}
                      >
                        <span className="inline-flex items-center gap-2">
                          {danger ? <CircleSlash className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                          {m.label}
                        </span>
                        {busy === `status-${to}` && <Loader2 className="w-4 h-4 animate-spin" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Detail */}
            <div className={`${glass} rounded-2xl p-5`}>
              <h3 className="text-sm font-semibold mb-3">Ficha técnica</h3>
              <div className="space-y-3">
                <DetailRow icon={Hammer} label="Tipo" value={TYPE_LABEL[t.type]} />
                <DetailRow icon={Layers} label="Cavidades" value={String(t.cavities)} />
                <DetailRow icon={Activity} label="Estado" value={sm.label} color={sm.color} />
                <DetailRow icon={MapPin} label="Ubicación" value={t.location || '—'} />
                <DetailRow icon={Cpu} label="Programa" value={t.programId || '—'} mono={!!t.programId} />
              </div>
            </div>
          </div>
        </div>
      </main>

      {usageOpen && <UsageModal tool={t} onClose={() => setUsageOpen(false)} onDone={() => { setUsageOpen(false); mutate(); }} />}
    </div>
  );
}

// ── Usage modal ──────────────────────────────────────────────────────────────
function UsageModal({ tool, onClose, onDone }: { tool: Tool; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [shots, setShots] = useState('');

  const n = Number(shots);
  const valid = shots.trim() !== '' && Number.isFinite(n) && n >= 1;
  const projectedUsed = tool.shotsUsed + (valid ? Math.floor(n) : 0);
  const projectedPct = tool.lifeShots > 0 ? Math.round(Math.min(100, (projectedUsed / tool.lifeShots) * 100) * 10) / 10 : 0;

  async function submit() {
    if (!valid) { toast.error('Escribe los disparos (mín. 1).', 'Tooling'); return; }
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/tooling/${tool.id}/usage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shots: Math.floor(n) }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || 'No se pudo registrar el uso.', 'Tooling');
        return;
      }
      toast.success(`+${Math.floor(n).toLocaleString()} disparos registrados.`, 'Tooling');
      onDone();
    } catch {
      toast.error('Error de red.', 'Tooling');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-16 bg-black/40 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className={`${glass} rounded-3xl p-6 w-full max-w-md`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold">Registrar disparos</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-[13px] text-gray-400 mb-4">Suma disparos de producción a la vida acumulada de <span className="font-medium text-gray-500">{tool.name}</span>.</p>
        <label className="block">
          <span className="block text-[12px] font-medium text-gray-500 mb-1">Disparos a sumar</span>
          <input
            type="number"
            min={1}
            autoFocus
            className={tlInput}
            value={shots}
            onChange={(e) => setShots(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && valid && !busy) submit(); }}
            placeholder="5000"
          />
        </label>
        {valid && (
          <div className="mt-3 text-[12px] text-gray-400 tabular-nums">
            Quedará en <span className="font-medium" style={{ color: lifeColor(projectedPct) }}>{projectedUsed.toLocaleString()}</span> / {tool.lifeShots.toLocaleString()} disparos · <span className="font-medium" style={{ color: lifeColor(projectedPct) }}>{projectedPct}%</span> de vida.
          </div>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
          <button onClick={submit} disabled={busy || !valid} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50" style={{ background: INDIGO }}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Registrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Small pieces ─────────────────────────────────────────────────────────────
function DetailRow({ icon: Icon, label, value, color, mono }: { icon: typeof Gauge; label: string; value: string; color?: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] uppercase tracking-wide text-gray-400">{label}</div>
        <div className={`text-sm font-medium truncate ${mono ? 'font-mono' : ''}`} style={color ? { color } : undefined} title={value}>{value}</div>
      </div>
    </div>
  );
}

function Guard() {
  return (
    <div className="min-h-screen grid place-items-center text-black dark:text-white">
      <div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}>
        <Lock className="w-8 h-8 mx-auto mb-3 text-gray-400" />
        <h2 className="text-lg font-semibold">Sin acceso</h2>
        <p className="text-sm text-gray-400 mt-1">Inicia sesión para ver el herramental.</p>
      </div>
    </div>
  );
}
