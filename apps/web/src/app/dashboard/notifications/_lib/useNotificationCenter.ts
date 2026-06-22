'use client';

import { useEffect, useMemo } from 'react';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useMesSignals } from '@/hooks/useMesSignals';
import { useReadState } from './readState';
import {
  normalizeAndon, normalizeHolds, normalizeDispositions, normalizeCancellations, normalizeNcr,
  normalizeMailbox,
} from './sources';
import type { AxosNotification, NotifKind, ResolvedNotification } from './types';

/**
 * Carril UI-NOTIF — agregador del centro de notificaciones.
 *
 * Lee cada fuente real con `useApi` (SWR, auto-refresh 20 s) y las funde en una
 * sola lista normalizada y ordenada. Incluye el BUZÓN persistente del servidor
 * (`/notifications`): sus avisos traen estado de leído REAL (`readAt`), que se
 * sincroniza entre dispositivos; las demás fuentes (andon/holds/…) son eventos
 * vivos del piso cuyo "leído" se guarda por-dispositivo (localStorage).
 *
 * Además engancha el socket de planta existente (`useMesSignals`): un andon /
 * incidente EN VIVO revalida el feed al instante.
 *
 * Fuentes con 403 (sin permiso) no rompen la vista: aportan 0 ítems y se
 * reportan en `unavailable` para mostrar una nota honesta.
 */

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

const SOURCES: Array<{ key: string; path: string; label: string }> = [
  { key: 'mailbox', path: '/notifications', label: 'Buzón (avisos)' },
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

/** ¿El id pertenece al buzón persistente del servidor? Devuelve el id real o null. */
function mailboxRealId(id: string): string | null {
  return id.startsWith('mailbox:') ? id.slice('mailbox:'.length) : null;
}

export function useNotificationCenter(): NotificationCenter {
  // Una llamada fija por fuente (respeta las reglas de hooks).
  const mailbox = useApi<unknown>(SOURCES[0].path);
  const andon = useApi<unknown>(SOURCES[1].path);
  const holds = useApi<unknown>(SOURCES[2].path);
  const disp = useApi<unknown>(SOURCES[3].path);
  const cancel = useApi<unknown>(SOURCES[4].path);
  const ncr = useApi<unknown>(SOURCES[5].path);

  const { isRead, markRead: markReadLocal, markUnread: markUnreadLocal, prune } = useReadState();

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
      ...(mailbox.forbidden ? [] : normalizeMailbox(mailbox.data)),
      ...(andon.forbidden ? [] : normalizeAndon(andon.data)),
      ...(holds.forbidden ? [] : normalizeHolds(holds.data)),
      ...(disp.forbidden ? [] : normalizeDispositions(disp.data)),
      ...(cancel.forbidden ? [] : normalizeCancellations(cancel.data)),
      ...(ncr.forbidden ? [] : normalizeNcr(ncr.data)),
    ];
    all.sort((a, b) => +new Date(b.at) - +new Date(a.at));
    // Buzón: estado de leído del servidor (n.read). Fuentes derivadas: estado local.
    return all.map((n) => ({ ...n, read: n.read ?? isRead(n.id) }));
  }, [
    mailbox.data, mailbox.forbidden,
    andon.data, andon.forbidden, holds.data, holds.forbidden, disp.data, disp.forbidden,
    cancel.data, cancel.forbidden, ncr.data, ncr.forbidden, isRead,
  ]);

  // Poda de ids LOCALES leídos obsoletos. Solo aplica a ids no-buzón (los del
  // buzón viven en servidor, nunca en localStorage). Se dispara cuando cambia el
  // conjunto de ids locales vivos (firma string), no por banderas de leído.
  const liveLocalSig = items.filter((i) => !mailboxRealId(i.id)).map((i) => i.id).join('|');
  useEffect(() => {
    prune(items.filter((i) => !mailboxRealId(i.id)).map((i) => i.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveLocalSig]);

  const counts = useMemo(() => {
    const c: Record<NotifKind | 'all' | 'unread', number> = {
      all: items.length, unread: 0, andon: 0, hold: 0, approval: 0, ncr: 0, system: 0,
    };
    for (const i of items) {
      c[i.kind] += 1;
      if (!i.read) c.unread += 1;
    }
    return c;
  }, [items]);

  const unavailable = useMemo(() => {
    const out: string[] = [];
    if (mailbox.forbidden) out.push(SOURCES[0].label);
    if (andon.forbidden) out.push(SOURCES[1].label);
    if (holds.forbidden) out.push(SOURCES[2].label);
    if (disp.forbidden) out.push(SOURCES[3].label);
    if (cancel.forbidden) out.push(SOURCES[4].label);
    if (ncr.forbidden) out.push(SOURCES[5].label);
    return out;
  }, [mailbox.forbidden, andon.forbidden, holds.forbidden, disp.forbidden, cancel.forbidden, ncr.forbidden]);

  const feeds = [mailbox, andon, holds, disp, cancel, ncr];
  const loading = feeds.every((f) => f.isLoading);

  // Marca leído/no-leído en el SERVIDOR para los avisos del buzón y revalida.
  async function postMailbox(realIds: string[], action: 'read' | 'unread') {
    await Promise.all(
      realIds.map((rid) =>
        apiFetch(`${API_BASE}/notifications/${rid}/${action}`, { method: 'POST' }).catch(() => null),
      ),
    );
    mailbox.mutate();
  }

  function markRead(arg: string | string[]) {
    const list = Array.isArray(arg) ? arg : [arg];
    const mailboxIds = list.map(mailboxRealId).filter((x): x is string => !!x);
    const localIds = list.filter((id) => !mailboxRealId(id));
    if (localIds.length) markReadLocal(localIds);
    if (mailboxIds.length) void postMailbox(mailboxIds, 'read');
  }

  function markUnread(id: string) {
    const rid = mailboxRealId(id);
    if (rid) void postMailbox([rid], 'unread');
    else markUnreadLocal(id);
  }

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
