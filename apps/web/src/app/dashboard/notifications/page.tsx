'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft, Bell, BellOff, Loader2, Inbox, Lock, RefreshCw, Check, ArrowRight, Radio,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { useWebPush } from '@/hooks/useWebPush';
import { IconTile } from '@/components/ui/IconTile';
import { PageHeader } from '@/components/ui/PageHeader';
import { timeAgo } from '@/lib/dashboardShared';
import { useToast } from '@/contexts/ToastContext';
import { useNotificationCenter } from './_lib/useNotificationCenter';
import { KIND_META, SEV_META } from './_lib/sources';
import type { NotifKind, ResolvedNotification } from './_lib/types';

const VIOLET = '#7c3aed';
const GRAY = '#6b7280';
const KINDS: NotifKind[] = ['andon', 'hold', 'approval', 'ncr', 'system'];

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

export default function NotificationsPage() {
  const toast = useToast();
  const router = useRouter();
  const center = useNotificationCenter();
  const { items, loading, realtime, unavailable, counts } = center;
  const push = useWebPush();

  const [kind, setKind] = useState<NotifKind | 'all'>('all');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const filtered = useMemo(
    () => items.filter((n) => (kind === 'all' || n.kind === kind) && (!unreadOnly || !n.read)),
    [items, kind, unreadOnly],
  );
  const today = filtered.filter((n) => isToday(n.at));
  const earlier = filtered.filter((n) => !isToday(n.at));

  // "Sin acceso" total: las 5 fuentes respondieron 403.
  const allForbidden = unavailable.length === 5;

  function open(n: ResolvedNotification) {
    center.markRead(n.id);
    if (n.href) router.push(n.href);
  }
  function markAll() {
    if (counts.unread === 0) return;
    center.markAllRead();
    toast.success(`${counts.unread} marcada(s) como leída(s).`, 'Notificaciones');
  }

  if (allForbidden) {
    return (
      <div className="min-h-[70vh] grid place-items-center text-foreground">
        <div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}>
          <Lock className="w-8 h-8 mx-auto mb-3 text-gray-500 dark:text-gray-400" />
          <h2 className="text-lg font-semibold">Sin acceso</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Tu rol no tiene permiso para ver ninguna de las fuentes de eventos (andon, calidad, aprobaciones, NCR).</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-foreground">
      <main className="max-w-3xl mx-auto px-6 pt-10 pb-24">
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 mb-4">
          <ChevronLeft className="w-4 h-4" /> Dashboard
        </Link>

        <PageHeader
          domain="mes"
          icon={Bell}
          title="Centro de notificaciones"
          subtitle="Eventos reales del piso: andones, holds de calidad, aprobaciones pendientes y NCRs — con enlace al origen."
          right={
            <div className="flex items-center gap-2">
              <RealtimePill status={realtime} />
              <button onClick={center.refresh} className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10" aria-label="Refrescar" title="Refrescar">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          }
        />

        {/* Filtros por tipo + no leídos */}
        <div className="flex items-center gap-1.5 flex-wrap mb-5">
          <Chip label="Todas" active={kind === 'all'} count={counts.all} onClick={() => setKind('all')} />
          {KINDS.map((k) => (
            <Chip
              key={k}
              label={KIND_META[k].label}
              color={KIND_META[k].color}
              active={kind === k}
              count={counts[k]}
              onClick={() => setKind(k)}
            />
          ))}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setUnreadOnly((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium border transition"
              style={unreadOnly
                ? { background: `${VIOLET}1f`, color: VIOLET, borderColor: `${VIOLET}66` }
                : { background: 'transparent', color: GRAY, borderColor: 'rgba(148,163,184,0.3)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: VIOLET }} /> Solo no leídas
              <span className="opacity-60">{counts.unread}</span>
            </button>
            <button
              onClick={markAll}
              disabled={counts.unread === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium text-white disabled:opacity-40"
              style={{ background: VIOLET }}
            >
              <Check className="w-3.5 h-3.5" /> Marcar todo leído
            </button>
          </div>
        </div>

        {/* Nota honesta: fuentes sin permiso */}
        {unavailable.length > 0 && (
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-4 -mt-2">
            Sin acceso (por permisos) a: {unavailable.join(', ')}.
          </p>
        )}

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-500 dark:text-gray-400" /></div>
        ) : filtered.length === 0 ? (
          <div className={`${glass} rounded-3xl p-12 text-center`}>
            <Inbox className="w-8 h-8 mx-auto mb-3 text-gray-500 dark:text-gray-400" />
            <h3 className="font-semibold">{unreadOnly || kind !== 'all' ? 'Nada en este filtro' : 'Estás al día'}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {unreadOnly || kind !== 'all' ? 'Cambia el filtro para ver otros eventos.' : 'No hay andones, holds, aprobaciones ni NCRs abiertos.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {today.length > 0 && <Group label="Hoy" items={today} onOpen={open} onToggle={center.markRead} onUnread={center.markUnread} />}
            {earlier.length > 0 && <Group label="Antes" items={earlier} onOpen={open} onToggle={center.markRead} onUnread={center.markUnread} />}
          </div>
        )}

        {/* Nota de alcance honesta sobre tiempo real + estado de leído. */}
        <div className="mt-8 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400 border-t border-black/5 dark:border-white/10 pt-4">
          <p>
            <b className="text-gray-500 dark:text-gray-300">Tiempo real:</b> los andones e incidentes en vivo
            actualizan el feed al instante por el socket de planta; el resto se refresca cada 20 s.
          </p>
          <p className="mt-1">
            <b className="text-gray-500 dark:text-gray-300">Estado de leído:</b> los avisos del{' '}
            <b className="text-gray-500 dark:text-gray-300">Buzón</b> usan estado de leído del servidor (se
            sincroniza entre dispositivos); los eventos vivos del piso (andon/holds/…) lo guardan por
            dispositivo (localStorage).
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span>
              <b className="text-gray-500 dark:text-gray-300">Push del navegador (PWA):</b>{' '}
              recibe los avisos del Buzón aunque la pestaña esté cerrada.
            </span>
            <PushToggle push={push} />
          </div>
        </div>
      </main>
    </div>
  );
}

// ── Subcomponentes locales ───────────────────────────────────────────────────
function PushToggle({ push }: { push: ReturnType<typeof useWebPush> }) {
  const { status, busy, enable, disable } = push;
  if (status === 'loading')
    return (
      <span className="inline-flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Comprobando…
      </span>
    );
  if (status === 'unsupported')
    return <span className="text-gray-500 dark:text-gray-400">Tu navegador no soporta push.</span>;
  if (status === 'unconfigured')
    return <span className="text-gray-500 dark:text-gray-400">Requiere configurar VAPID en el servidor.</span>;
  if (status === 'denied')
    return <span className="text-gray-500 dark:text-gray-400">Notificaciones bloqueadas en el navegador.</span>;

  const on = status === 'subscribed';
  return (
    <button
      onClick={on ? disable : enable}
      disabled={busy}
      aria-pressed={on}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium border transition disabled:opacity-50"
      style={on
        ? { background: `${VIOLET}1f`, color: VIOLET, borderColor: `${VIOLET}66` }
        : { background: 'transparent', color: GRAY, borderColor: 'rgba(148,163,184,0.3)' }}
    >
      {busy ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : on ? (
        <BellOff className="w-3.5 h-3.5" />
      ) : (
        <Bell className="w-3.5 h-3.5" />
      )}
      {on ? 'Desactivar push' : 'Activar push'}
    </button>
  );
}

function RealtimePill({ status }: { status: string }) {
  const live = status === 'connected';
  const color = live ? '#10b981' : status === 'error' || status === 'disconnected' ? '#9ca3af' : '#f59e0b';
  const label = live ? 'En vivo' : status === 'connecting' ? 'Conectando…' : 'Sin conexión';
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium" style={{ background: `${color}1f`, color }}>
      <Radio className="w-3 h-3" /> {label}
    </span>
  );
}

function Group({
  label, items, onOpen, onToggle, onUnread,
}: {
  label: string;
  items: ResolvedNotification[];
  onOpen: (n: ResolvedNotification) => void;
  onToggle: (id: string) => void;
  onUnread: (id: string) => void;
}) {
  return (
    <section>
      <p className="px-1 mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</p>
      <div className={`${glass} rounded-2xl divide-y divide-black/5 dark:divide-white/10 overflow-hidden`}>
        {items.map((n) => <Row key={n.id} n={n} onOpen={onOpen} onToggle={onToggle} onUnread={onUnread} />)}
      </div>
    </section>
  );
}

function Row({
  n, onOpen, onToggle, onUnread,
}: {
  n: ResolvedNotification;
  onOpen: (n: ResolvedNotification) => void;
  onToggle: (id: string) => void;
  onUnread: (id: string) => void;
}) {
  const sev = SEV_META[n.severity];
  const flagged = n.severity === 'critical' || n.severity === 'high';
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(n)}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(n); }}
      className={`group relative flex items-start gap-3 p-3.5 text-left transition-colors cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/[0.05] ${n.read ? 'opacity-70' : ''}`}
      style={flagged ? { boxShadow: `inset 3px 0 0 ${sev.color}` } : undefined}
    >
      <IconTile domain={n.domain} icon={n.icon} size={38} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={`text-sm truncate ${n.read ? 'font-medium' : 'font-semibold'}`}>{n.title}</p>
          {flagged && (
            <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: `${sev.color}1f`, color: sev.color }}>{sev.label}</span>
          )}
          {n.href && <ArrowRight className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />}
        </div>
        {n.body && <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{n.body}</p>}
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">{n.source} · {timeAgo(n.at)}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0 pt-1">
        {!n.read && <span className="h-2 w-2 rounded-full bg-primary" title="No leída" />}
        <button
          onClick={(e) => { e.stopPropagation(); if (n.read) onUnread(n.id); else onToggle(n.id); }}
          className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
          title={n.read ? 'Marcar como no leída' : 'Marcar como leída'}
        >
          <Check className="w-4 h-4" style={n.read ? { color: '#10b981' } : undefined} />
        </button>
      </div>
    </div>
  );
}

function Chip({ label, count, active, color = GRAY, onClick }: { label: string; count: number; active: boolean; color?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition border"
      style={active ? { background: `${color}1f`, color, borderColor: `${color}66` } : { background: 'transparent', color: GRAY, borderColor: 'rgba(148,163,184,0.3)' }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} /> {label}
      <span className="opacity-60">{count}</span>
    </button>
  );
}
