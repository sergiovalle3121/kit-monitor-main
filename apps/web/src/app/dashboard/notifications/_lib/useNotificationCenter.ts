'use client';

import { useEffect, useMemo } from 'react';
import { useApi } from '@/hooks/useApi';
import { useMesSignals } from '@/hooks/useMesSignals';
import { useReadState } from './readState';
import {
  normalizeAndon, normalizeHolds, normalizeDispositions, normalizeCancellations, normalizeNcr,
} from './sources';
import type { AxosNotification, NotifKind, ResolvedNotification } from './types';

/**
 * Carril UI-NOTIF — agregador del centro de notificaciones.
 *
 * Lee cada fuente real con `useApi` (SWR, auto-refresh 20 s) y las funde en una
 * sola lista normalizada y ordenada. Además engancha el socket de planta
 * existente (`useMesSignals`): un andon / incidente EN VIVO revalida el feed al
 * instante — tiempo real aprovechando infra existente, sin backend nuevo.
 *
 * Fuentes con 403 (sin permiso) no rompen la vista: aportan 0 ítems y se
 * reportan en `unavailable` para mostrar una nota honesta.
 */

const SOURCES: Array<{ key: string; path: string; label: string }> = [
  { key: 'andon', path: '/operator-terminal/floor-events?status=OPEN', label: 'Andon (producción)' },
  { key: 'hold', path: '/floor-quality/holds', label: 'Holds de calidad' },
  { key: 'disp', path: '/quality/dispositions', label: 'Aprobaciones de disposición' },
  { key: 'cancel', path: '/cancellation-requests/pending', label: 'Solicitudes de cancelación' },
  { key: 'ncr', path: '/ncr', label: 'NCRs' },
];

export interface NotificationCenter {
  items: ResolvedNotification[];
  loading: boolean;
  /** Estado del socket de planta: connecting | connected | disconnected | error. */
  realtime: string;
  /** Fuentes no disponibles por permisos (nota honesta). */
  unavailable: string[];
  counts: Record<NotifKind | 'all' | 'unread', number>;
  isRead: (id: string) => boolean;
  markRead: (ids: string | string[]) => void;
  markUnread: (id: string) => void;
  markAllRead: () => void;
  refresh: () => void;
}

export function useNotificationCenter(): NotificationCenter {
  // Una llamada fija por fuente (respeta las reglas de hooks).
  const andon = useApi<unknown>(SOURCES[0].path);
  const holds = useApi<unknown>(SOURCES[1].path);
  const disp = useApi<unknown>(SOURCES[2].path);
  const cancel = useApi<unknown>(SOURCES[3].path);
  const ncr = useApi<unknown>(SOURCES[4].path);

  const { isRead, markRead, markUnread, prune } = useReadState();

  // Tiempo real: refrescamos el feed de andon ante señales de piso en vivo.
  const { status: realtime } = useMesSignals((e) => {
    switch (e.event) {
      case 'mes:andon':
      case 'mes:incident-raised':
      case 'mes:incident-dispositioned':
      case 'mes:shortage':
      case 'mes:event-reverted':
        andon.mutate();
        break;
    }
  });

  const items = useMemo<ResolvedNotification[]>(() => {
    const all: AxosNotification[] = [
      ...(andon.forbidden ? [] : normalizeAndon(andon.data)),
      ...(holds.forbidden ? [] : normalizeHolds(holds.data)),
      ...(disp.forbidden ? [] : normalizeDispositions(disp.data)),
      ...(cancel.forbidden ? [] : normalizeCancellations(cancel.data)),
      ...(ncr.forbidden ? [] : normalizeNcr(ncr.data)),
    ];
    all.sort((a, b) => +new Date(b.at) - +new Date(a.at));
    return all.map((n) => ({ ...n, read: isRead(n.id) }));
  }, [
    andon.data, andon.forbidden, holds.data, holds.forbidden, disp.data, disp.forbidden,
    cancel.data, cancel.forbidden, ncr.data, ncr.forbidden, isRead,
  ]);

  // Poda de ids leídos obsoletos. Se dispara solo cuando cambia el CONJUNTO de
  // ids vivos (firma string), no cuando cambian las banderas de leído → sin bucle.
  const liveSig = items.map((i) => i.id).join('|');
  useEffect(() => {
    prune(items.map((i) => i.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveSig]);

  const counts = useMemo(() => {
    const c: Record<NotifKind | 'all' | 'unread', number> = {
      all: items.length, unread: 0, andon: 0, hold: 0, approval: 0, ncr: 0,
    };
    for (const i of items) {
      c[i.kind] += 1;
      if (!i.read) c.unread += 1;
    }
    return c;
  }, [items]);

  const unavailable = useMemo(() => {
    const out: string[] = [];
    if (andon.forbidden) out.push(SOURCES[0].label);
    if (holds.forbidden) out.push(SOURCES[1].label);
    if (disp.forbidden) out.push(SOURCES[2].label);
    if (cancel.forbidden) out.push(SOURCES[3].label);
    if (ncr.forbidden) out.push(SOURCES[4].label);
    return out;
  }, [andon.forbidden, holds.forbidden, disp.forbidden, cancel.forbidden, ncr.forbidden]);

  const feeds = [andon, holds, disp, cancel, ncr];
  const loading = feeds.every((f) => f.isLoading);

  function markAllRead() {
    markRead(items.filter((i) => !i.read).map((i) => i.id));
  }
  function refresh() {
    feeds.forEach((f) => f.mutate());
  }

  return {
    items, loading, realtime, unavailable, counts,
    isRead, markRead, markUnread, markAllRead, refresh,
  };
}
