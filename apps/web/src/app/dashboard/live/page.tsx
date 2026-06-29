'use client';

import React, { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  ChevronLeft, Activity, Lock, Loader2, Inbox, RefreshCw, Siren, ShieldX,
  Truck, Gauge, PlayCircle, PauseCircle, AlertTriangle, CheckCircle2, Wifi,
  WifiOff, Factory, Radio,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { apiFetch } from '@/lib/apiFetch';
import { useApi } from '@/hooks/useApi';
import { useLiveEvents } from '@/hooks/useLiveEvents';
import {
  CHANNEL_META, LIVE_CHANNELS, LiveEvent, LiveSnapshot,
  actionLabel, timeAgo,
} from '@/lib/liveChannels';

const GREEN = '#10b981';
const AMBER = '#f59e0b';
const RED = '#ef4444';
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

type Light = 'green' | 'amber' | 'red';
const LIGHT: Record<Light, { color: string; label: string }> = {
  green: { color: GREEN, label: 'En verde' },
  amber: { color: AMBER, label: 'Atención' },
  red: { color: RED, label: 'Crítico' },
};
const pct = (n: number) => `${Math.round((n || 0) * 100)}%`;

// ── Backend shapes (reused endpoints, GREP'd — not invented) ──────────────────
interface SummaryLine {
  line: string; light: Light; woOpen: number; woReady: number; unitsPlanned: number;
  unitsCompleted: number; adherencePct: number; behind: number; openAndons: number;
  openHolds: number; openReplenish: number; models: string[]; reasons: string[];
}
interface Summary {
  global: Light; lines: SummaryLine[];
  totals: { lines: number; woOpen: number; openAndons: number; openHolds: number; openReplenish: number; adherencePct: number };
  generatedAt: string;
}
interface OeeCard {
  line: string; oee: number; availability: number; performance: number; quality: number;
  output: number; goodPieces: number; downtimeMinutes: number; openDowntime: number;
}
interface OeeFeed {
  generatedAt: string; lines: OeeCard[];
  rollup: { avgOee: number; totalOutput: number; totalDowntimeMinutes: number; openDowntime: number };
}
interface Hold {
  id: string; folio: string | null; part: string; status: string; severity: string;
  defectType: string | null; woFolio: string | null; station: string | null; raisedAt: string | null;
}
interface LiveAndon {
  id: number;
  executionId: number;
  executionStepId: number | null;
  workOrder: string | null;
  model: string | null;
  line: number | string | null;
  type: string;
  status: 'open' | 'ack' | 'resolved';
  stepName: string | null;
  note: string | null;
  raisedBy: string | null;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  responseRole: string;
  createdAt: string;
}

const ACTIVE_HOLD = (s: string) => s !== 'CLOSED' && s !== 'CANCELLED';

interface MergedLine extends Partial<OeeCard> {
  line: string; light: Light; running: boolean;
  unitsPlanned: number; unitsCompleted: number; adherencePct: number;
  openAndons: number; openHolds: number; openReplenish: number;
  models: string[]; reasons: string[];
}

export default function LiveFloorPage() {
  const reduce = useReducedMotion();

  const summary = useApi<Summary>('/line-control-tower/summary', { refreshInterval: 15000 });
  const oee = useApi<OeeFeed>('/oee/control-tower', { refreshInterval: 20000 });
  const holds = useApi<Hold[]>('/floor-quality/holds', { refreshInterval: 20000 });
  const andons = useApi<LiveAndon[]>('/mes/andons?limit=20', { refreshInterval: 15000 });
  const snap = useApi<LiveSnapshot>('/live/snapshot?limit=30', { refreshInterval: 30000 });
  const [transitioningAndon, setTransitioningAndon] = useState<string | null>(null);
  const [andonActionError, setAndonActionError] = useState<string | null>(null);

  // Live stream nudges the aggregates so the board "breathes" on real events.
  const onEvent = useCallback(
    (e: LiveEvent) => {
      summary.mutate();
      if (e.channel === 'andon') andons.mutate();
      if (e.channel === 'oee' || e.channel === 'andon' || e.channel === 'production') oee.mutate();
      if (e.channel === 'quality') holds.mutate();
    },
    [summary, oee, holds, andons],
  );
  const live = useLiveEvents(LIVE_CHANNELS, { onEvent, max: 60 });

  const transitionAndon = useCallback(
    async (andonId: number, action: 'ack' | 'resolve') => {
      const key = `${andonId}:${action}`;
      setTransitioningAndon(key);
      setAndonActionError(null);
      try {
        const res = await apiFetch(`${API_BASE}/mes/andon/${andonId}/${action}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(typeof body.message === 'string' ? body.message : 'No se pudo actualizar el Andon.');
        }
        await Promise.all([andons.mutate(), summary.mutate(), oee.mutate(), snap.mutate()]);
      } catch (err) {
        setAndonActionError(err instanceof Error ? err.message : 'No se pudo actualizar el Andon.');
      } finally {
        setTransitioningAndon(null);
      }
    },
    [andons, oee, snap, summary],
  );

  // Merge the line truth (control tower) with live OEE by line name.
  const lines = useMemo<MergedLine[]>(() => {
    const oeeByLine = new Map((oee.data?.lines ?? []).map((c) => [c.line, c]));
    const names = new Set<string>([
      ...(summary.data?.lines ?? []).map((l) => l.line),
      ...(oee.data?.lines ?? []).map((c) => c.line),
    ]);
    const sBy = new Map((summary.data?.lines ?? []).map((l) => [l.line, l]));
    return Array.from(names)
      .map((line) => {
        const s = sBy.get(line);
        const o = oeeByLine.get(line);
        const openAndons = s?.openAndons ?? 0;
        return {
          line,
          light: s?.light ?? 'green',
          running: openAndons === 0,
          unitsPlanned: s?.unitsPlanned ?? 0,
          unitsCompleted: s?.unitsCompleted ?? 0,
          adherencePct: s?.adherencePct ?? 0,
          openAndons,
          openHolds: s?.openHolds ?? 0,
          openReplenish: s?.openReplenish ?? 0,
          models: s?.models ?? [],
          reasons: s?.reasons ?? [],
          ...o,
        } as MergedLine;
      })
      .sort((a, b) => a.line.localeCompare(b.line));
  }, [summary.data, oee.data]);

  // Combined ticker: live socket events tail + REST snapshot seed, de-duped.
  const ticker = useMemo<LiveEvent[]>(() => {
    const seen = new Set<string>();
    const out: LiveEvent[] = [];
    for (const e of [...live.events, ...(snap.data?.events ?? [])]) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      out.push(e);
    }
    return out
      .sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp))
      .slice(0, 30);
  }, [live.events, snap.data]);

  const activeHolds = (holds.data ?? []).filter((h) => ACTIVE_HOLD(h.status));
  const activeAndons = (andons.data ?? []).filter((a) => a.status !== 'resolved');

  if (summary.forbidden) {
    return (
      <div className="min-h-screen grid place-items-center text-foreground">
        <div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}>
          <Lock className="w-8 h-8 mx-auto mb-3 text-gray-400" />
          <h2 className="text-lg font-semibold">Sin acceso</h2>
          <p className="text-sm text-gray-400 mt-1">Necesitas permiso de producción para ver el piso en vivo.</p>
        </div>
      </div>
    );
  }

  const loading = summary.isLoading && !summary.data;

  return (
    <div className="min-h-screen text-foreground">
      {/* Header */}
      <div className={`${glass} sticky top-0 z-40 px-6 py-4`}>
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <Link href="/dashboard" className="p-2 -ml-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10"><ChevronLeft className="w-5 h-5" /></Link>
          <span className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: 'rgba(16,185,129,0.14)' }}>
            <Activity className="w-5 h-5" style={{ color: GREEN }} />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold leading-tight">Piso en Vivo</h1>
            <p className="text-[12px] text-gray-400 leading-tight">La planta respirando — estado de línea, avance, OEE, holds y eventos, actualizándose solo.</p>
          </div>
          <LivePill status={live.status} reduce={!!reduce} />
          <button onClick={() => { summary.mutate(); oee.mutate(); holds.mutate(); andons.mutate(); snap.mutate(); }} className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10" title="Refrescar"><RefreshCw className="w-4 h-4" /></button>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 pt-8 pb-24">
        {/* Global banner */}
        {summary.data && (
          <div className="rounded-2xl p-5 mb-6 flex flex-wrap items-center gap-4" style={{ background: `${LIGHT[summary.data.global].color}14`, border: `1px solid ${LIGHT[summary.data.global].color}55` }}>
            <BreathingDot color={LIGHT[summary.data.global].color} reduce={!!reduce} />
            <div className="flex-1 min-w-[180px]">
              <div className="font-semibold" style={{ color: LIGHT[summary.data.global].color }}>Estado global: {LIGHT[summary.data.global].label}</div>
              <div className="text-[12px] text-gray-500">{summary.data.totals.lines} líneas · {summary.data.totals.woOpen} WO abiertas · adherencia {pct(summary.data.totals.adherencePct)}</div>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <Tot icon={Gauge} label="OEE prom." value={oee.data ? pct(oee.data.rollup.avgOee) : (oee.forbidden ? '—' : '…')} color={GREEN} />
              <Tot icon={Siren} label="Andons" value={summary.data.totals.openAndons} color={RED} />
              <Tot icon={ShieldX} label="Holds" value={summary.data.totals.openHolds} color={RED} />
              <Tot icon={Truck} label="Reposición" value={summary.data.totals.openReplenish} color={AMBER} />
            </div>
          </div>
        )}

        {/* Lines */}
        <SectionTitle icon={Factory} title="Líneas" hint="corriendo / parada vía andon · plan vs meta · OEE en vivo" />
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : lines.length === 0 ? (
          <Empty icon={Inbox} title="Sin líneas activas" hint="Publica WOs en el muro del plan para ver las líneas respirar aquí." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lines.map((l) => (
              <LineCard key={l.line} l={l} oeeForbidden={oee.forbidden} />
            ))}
          </div>
        )}

        <section className="mt-10">
          <SectionTitle icon={Siren} title="Andons activos" hint="confirmar respuesta y cerrar desde supervisión" />
          {andons.forbidden ? (
            <Empty icon={Lock} title="Sin acceso a Andons" hint="Necesitas permiso de producción para responder llamadas del piso." />
          ) : andons.isLoading && !andons.data ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
          ) : activeAndons.length === 0 ? (
            <Empty icon={CheckCircle2} title="Sin Andons activos" hint="No hay llamadas abiertas o en atención." tone={GREEN} />
          ) : (
            <>
              {andonActionError && (
                <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">
                  {andonActionError}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {activeAndons.map((andon) => (
                  <AndonCard
                    key={andon.id}
                    andon={andon}
                    busyKey={transitioningAndon}
                    onTransition={transitionAndon}
                  />
                ))}
              </div>
            </>
          )}
        </section>

        {/* Quality holds + ticker */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-10">
          <section>
            <SectionTitle icon={ShieldX} title="Holds de calidad activos" hint="cuarentena que bloquea WO" />
            {holds.forbidden ? (
              <Empty icon={Lock} title="Sin acceso a calidad" hint="Necesitas permiso de calidad para ver los holds." />
            ) : holds.isLoading && !holds.data ? (
              <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
            ) : activeHolds.length === 0 ? (
              <Empty icon={CheckCircle2} title="Sin holds activos" hint="Ningún material en cuarentena. Calidad despejada." tone={GREEN} />
            ) : (
              <ul className="space-y-2">
                {activeHolds.slice(0, 8).map((h) => <HoldRow key={h.id} h={h} />)}
              </ul>
            )}
          </section>

          <section>
            <SectionTitle icon={Radio} title="Eventos recientes" hint="el ledger del piso, en vivo" />
            {ticker.length === 0 ? (
              <Empty icon={Inbox} title="Sin eventos aún" hint="El piso está en silencio. Los eventos aparecerán aquí en cuanto ocurran." />
            ) : (
              <ul className={`${glass} rounded-2xl p-2 divide-y divide-black/5 dark:divide-white/5`}>
                <AnimatePresence initial={false}>
                  {ticker.map((e) => (
                    <motion.li
                      key={e.id}
                      layout={!reduce}
                      initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: reduce ? 0.001 : 0.25 }}
                    >
                      <EventRow e={e} />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </section>
        </div>

        <div className="mt-8 text-center text-[11px] text-gray-400">
          {summary.data ? <>Actualizado {new Date(summary.data.generatedAt).toLocaleTimeString()} · </> : null}
          stream {live.status === 'connected' ? 'en vivo' : live.status === 'connecting' ? 'conectando…' : 'reconectando…'}
        </div>
      </main>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function LineCard({ l, oeeForbidden }: { l: MergedLine; oeeForbidden: boolean }) {
  const stateColor = l.running ? GREEN : RED;
  const hasOee = typeof l.oee === 'number';
  return (
    <div className={`${glass} rounded-2xl p-5`} style={{ borderTop: `3px solid ${LIGHT[l.light].color}` }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {l.running
            ? <PlayCircle className="w-5 h-5 flex-shrink-0" style={{ color: GREEN }} />
            : <PauseCircle className="w-5 h-5 flex-shrink-0" style={{ color: RED }} />}
          <h3 className="font-semibold text-lg truncate">{l.line}</h3>
        </div>
        <span className="text-[11px] px-2 py-0.5 rounded font-medium" style={{ background: `${stateColor}1f`, color: stateColor }}>
          {l.running ? 'Corriendo' : 'Parada'}
        </span>
      </div>

      {/* WO progress vs goal */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-[12px] text-gray-400"><span>Avance vs meta</span><span>{l.unitsCompleted}/{l.unitsPlanned} · {pct(l.adherencePct)}</span></div>
        <div className="mt-1 h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, Math.round(l.adherencePct * 100))}%`, background: LIGHT[l.light].color }} />
        </div>
      </div>

      {/* OEE live */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-[12px] text-gray-400">
          <span className="flex items-center gap-1"><Gauge className="w-3.5 h-3.5" /> OEE en vivo</span>
          <span className="font-semibold text-base" style={{ color: hasOee ? oeeColor(l.oee!) : '#9ca3af' }}>
            {hasOee ? pct(l.oee!) : (oeeForbidden ? 'sin acceso' : '—')}
          </span>
        </div>
        {hasOee && (
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Apq label="Disp." v={l.availability ?? 0} />
            <Apq label="Rend." v={l.performance ?? 0} />
            <Apq label="Cal." v={l.quality ?? 0} />
          </div>
        )}
      </div>

      {/* Badges */}
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Mini icon={Siren} label="Andons" value={l.openAndons} color={l.openAndons ? RED : undefined} />
        <Mini icon={ShieldX} label="Holds" value={l.openHolds} color={l.openHolds ? RED : undefined} />
        <Mini icon={Truck} label="Repos." value={l.openReplenish} color={l.openReplenish ? AMBER : undefined} />
      </div>

      {l.models.length > 0 && <div className="mt-3 text-[11px] text-gray-400 truncate">Modelos: {l.models.join(', ')}</div>}

      {l.reasons.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {l.reasons.map((r, i) => <li key={i} className="text-[12px] flex items-start gap-1.5" style={{ color: LIGHT[l.light].color }}><AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> {r}</li>)}
        </ul>
      ) : (
        <div className="mt-3 text-[12px] flex items-center gap-1.5" style={{ color: GREEN }}><CheckCircle2 className="w-3.5 h-3.5" /> Lista para correr</div>
      )}
    </div>
  );
}

const ANDON_TYPE_LABEL: Record<string, string> = {
  material: 'Material',
  materialist: 'Materialista',
  quality: 'Calidad',
  maintenance: 'Mantenimiento',
  stop: 'Paro',
  supervisor: 'Supervisor',
  engineering: 'Ingeniería',
  tooling: 'Tooling',
};

function AndonCard({
  andon,
  busyKey,
  onTransition,
}: {
  andon: LiveAndon;
  busyKey: string | null;
  onTransition: (id: number, action: 'ack' | 'resolve') => Promise<void>;
}) {
  const acknowledged = andon.status === 'ack';
  const tone = acknowledged ? AMBER : RED;
  const ackBusy = busyKey === `${andon.id}:ack`;
  const resolveBusy = busyKey === `${andon.id}:resolve`;
  const busy = Boolean(busyKey?.startsWith(`${andon.id}:`));
  const context = [
    andon.workOrder ? `WO ${andon.workOrder}` : null,
    andon.line ? `Línea ${andon.line}` : null,
    andon.stepName,
  ].filter(Boolean);

  return (
    <div className={`${glass} rounded-2xl p-4`} style={{ borderTop: `3px solid ${tone}` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `${tone}1f`, color: tone }}>
              <Siren className="h-3 w-3" />
              {ANDON_TYPE_LABEL[andon.type] ?? andon.type}
            </span>
            <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-white/10">
              {acknowledged ? 'En atención' : 'Abierto'}
            </span>
          </div>
          <div className="mt-2 text-sm font-semibold truncate">
            {context.join(' · ') || `Ejecución ${andon.executionId}`}
          </div>
          <div className="mt-1 text-[12px] text-gray-400">
            {andon.model ?? 'Modelo sin dato'} · {timeAgo(andon.createdAt)}
          </div>
        </div>
        {busy && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-gray-400" />}
      </div>

      {andon.note && (
        <p className="mt-3 line-clamp-2 text-sm text-gray-600 dark:text-gray-300">
          {andon.note}
        </p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-gray-500">
        <div className="rounded-xl bg-black/[0.03] px-2 py-1.5 dark:bg-white/[0.04]">
          <div className="uppercase tracking-wide text-gray-400">Respondedor</div>
          <div className="truncate font-medium">{andon.responseRole}</div>
        </div>
        <div className="rounded-xl bg-black/[0.03] px-2 py-1.5 dark:bg-white/[0.04]">
          <div className="uppercase tracking-wide text-gray-400">Confirmado por</div>
          <div className="truncate font-medium">{andon.acknowledgedBy ?? 'Pendiente'}</div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void onTransition(andon.id, 'ack')}
          disabled={andon.status !== 'open' || busy}
          className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-black/[0.04] px-3 text-sm font-semibold text-gray-700 transition hover:bg-black/[0.07] disabled:cursor-not-allowed disabled:opacity-45 dark:bg-white/[0.08] dark:text-gray-100 dark:hover:bg-white/[0.12]"
        >
          {ackBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Confirmar
        </button>
        <button
          type="button"
          onClick={() => void onTransition(andon.id, 'resolve')}
          disabled={busy}
          className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
          style={{ background: GREEN }}
        >
          {resolveBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Resolver
        </button>
      </div>
    </div>
  );
}

function EventRow({ e }: { e: LiveEvent }) {
  const meta = CHANNEL_META[e.channel];
  const detail = [e.line, e.workOrder, e.model].filter(Boolean).join(' · ');
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: meta.color }} />
      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: `${meta.color}1f`, color: meta.color }}>{meta.label}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate">{actionLabel(e.action)}</div>
        {detail && <div className="text-[11px] text-gray-400 truncate">{detail}</div>}
      </div>
      <span className="text-[11px] text-gray-400 flex-shrink-0 tabular-nums">{timeAgo(e.timestamp)}</span>
    </div>
  );
}

function HoldRow({ h }: { h: Hold }) {
  const sev = h.severity === 'CRITICAL' || h.severity === 'HIGH' ? RED : AMBER;
  return (
    <li className={`${glass} rounded-xl px-3 py-2.5 flex items-center gap-3`}>
      <ShieldX className="w-4 h-4 flex-shrink-0" style={{ color: sev }} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{h.folio ?? 'Hold'} · {h.part}</div>
        <div className="text-[11px] text-gray-400 truncate">
          {[h.defectType, h.woFolio, h.station].filter(Boolean).join(' · ') || 'En cuarentena'}
        </div>
      </div>
      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: `${sev}1f`, color: sev }}>{h.status}</span>
    </li>
  );
}

function LivePill({ status, reduce }: { status: string; reduce: boolean }) {
  const map: Record<string, { color: string; label: string; icon: React.ElementType }> = {
    connected: { color: GREEN, label: 'En vivo', icon: Wifi },
    connecting: { color: AMBER, label: 'Conectando', icon: Wifi },
    disconnected: { color: '#9ca3af', label: 'Sin conexión', icon: WifiOff },
    error: { color: RED, label: 'Sin conexión', icon: WifiOff },
  };
  const s = map[status] ?? map.disconnected;
  const Icon = s.icon;
  return (
    <span className="hidden sm:flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded-full" style={{ background: `${s.color}14`, color: s.color }}>
      {status === 'connected'
        ? <BreathingDot color={s.color} reduce={reduce} small />
        : <Icon className="w-3.5 h-3.5" />}
      {s.label}
    </span>
  );
}

function BreathingDot({ color, reduce, small }: { color: string; reduce: boolean; small?: boolean }) {
  const size = small ? 8 : 14;
  if (reduce) {
    return <span className="rounded-full flex-shrink-0" style={{ width: size, height: size, background: color, boxShadow: `0 0 0 4px ${color}33` }} />;
  }
  return (
    <motion.span
      className="rounded-full flex-shrink-0"
      style={{ width: size, height: size, background: color }}
      animate={{ boxShadow: [`0 0 0 0 ${color}66`, `0 0 0 ${small ? 5 : 8}px ${color}00`] }}
      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
    />
  );
}

function SectionTitle({ icon: Icon, title, hint }: { icon: React.ElementType; title: string; hint?: string }) {
  return (
    <div className="flex items-baseline gap-2 mb-3">
      <Icon className="w-4 h-4 text-gray-400 self-center" />
      <h2 className="font-semibold">{title}</h2>
      {hint && <span className="text-[12px] text-gray-400">— {hint}</span>}
    </div>
  );
}

function Empty({ icon: Icon, title, hint, tone }: { icon: React.ElementType; title: string; hint: string; tone?: string }) {
  return (
    <div className={`${glass} rounded-2xl p-8 text-center`}>
      <Icon className="w-7 h-7 mx-auto mb-2" style={{ color: tone ?? '#9ca3af' }} />
      <h3 className="font-semibold text-sm">{title}</h3>
      <p className="text-[12px] text-gray-400 mt-1">{hint}</p>
    </div>
  );
}

function Tot({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number | string; color: string }) {
  return <div className="flex items-center gap-1.5" title={label}><Icon className="w-4 h-4" style={{ color: value ? color : '#9ca3af' }} /> <b>{value}</b></div>;
}
function Mini({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color?: string }) {
  return (
    <div className="rounded-xl p-2 bg-black/[0.03] dark:bg-white/[0.04]">
      <Icon className="w-3.5 h-3.5 mx-auto" style={{ color: color ?? '#9ca3af' }} />
      <div className="text-lg font-semibold" style={{ color }}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div>
    </div>
  );
}
function Apq({ label, v }: { label: string; v: number }) {
  return (
    <div className="text-center">
      <div className="h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.round(v * 100))}%`, background: oeeColor(v) }} /></div>
      <div className="text-[10px] text-gray-400 mt-1">{label} {pct(v)}</div>
    </div>
  );
}

function oeeColor(v: number): string {
  if (v >= 0.85) return GREEN;
  if (v >= 0.6) return AMBER;
  return RED;
}
