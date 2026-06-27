'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/apiFetch';

// The push endpoints live on the backend (global /api prefix), NOT as Next route
// handlers — so they must be called through NEXT_PUBLIC_API_URL (ends in /api),
// not same-origin. apiFetch does not prepend a base, so build the URL explicitly.
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

/**
 * Web Push (PWA) para el navegador del usuario. El service worker (`/sw.js`) se
 * registra de forma PEREZOSA, solo cuando el usuario activa el push — quien no
 * lo usa no carga ningún SW. Degrada con honestidad:
 *   - `unsupported`: el navegador no soporta SW/Push/Notification.
 *   - `unconfigured`: el backend no tiene llaves VAPID (el push real no emite).
 *   - `denied`: el usuario bloqueó las notificaciones.
 *   - `idle` / `subscribed`: listo para activar / ya activado en este navegador.
 */
export type WebPushStatus =
  | 'loading'
  | 'unsupported'
  | 'unconfigured'
  | 'denied'
  | 'idle'
  | 'subscribed';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  // Vista sobre un ArrayBuffer explícito → Uint8Array<ArrayBuffer> (lo que pide
  // BufferSource en lib.dom de TS 5.7; un `new Uint8Array(n)` da ArrayBufferLike).
  const buffer = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

const isSupported = (): boolean =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

async function fetchKey(): Promise<{ publicKey: string | null; configured: boolean }> {
  try {
    const res = await apiFetch(`${API_BASE}/notifications/push/key`);
    const data = await res.json().catch(() => ({}));
    return { publicKey: data?.publicKey ?? null, configured: Boolean(data?.configured) };
  } catch {
    return { publicKey: null, configured: false };
  }
}

export function useWebPush() {
  const [status, setStatus] = useState<WebPushStatus>('loading');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!isSupported()) {
      setStatus('unsupported');
      return;
    }
    const { configured, publicKey } = await fetchKey();
    if (!configured || !publicKey) {
      setStatus('unconfigured');
      return;
    }
    if (Notification.permission === 'denied') {
      setStatus('denied');
      return;
    }
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      setStatus(sub ? 'subscribed' : 'idle');
    } catch {
      setStatus('idle');
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void refresh();
    });
  }, [refresh]);

  const enable = useCallback(async () => {
    if (!isSupported() || busy) return;
    setBusy(true);
    try {
      const { configured, publicKey } = await fetchKey();
      if (!configured || !publicKey) {
        setStatus('unconfigured');
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setStatus(perm === 'denied' ? 'denied' : 'idle');
        return;
      }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      await apiFetch(`${API_BASE}/notifications/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      setStatus('subscribed');
    } catch {
      setStatus('idle');
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const disable = useCallback(async () => {
    if (!isSupported() || busy) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await apiFetch(`${API_BASE}/notifications/push/unsubscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus('idle');
    } catch {
      /* best-effort */
    } finally {
      setBusy(false);
    }
  }, [busy]);

  return { status, busy, enable, disable, refresh };
}
