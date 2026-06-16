'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { LiveChannel, LiveEvent } from '@/lib/liveChannels';

export type LiveStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface UseLiveEventsOptions {
  /** Ring-buffer size for the returned `events` (default 50). */
  max?: number;
  /** Side-effect fired on every event (e.g. revalidate a board). */
  onEvent?: (event: LiveEvent) => void;
  /** Set false to keep the socket closed (e.g. while unauthorized). */
  enabled?: boolean;
}

/**
 * useLiveEvents(channel|channels)
 *
 * Reusable subscription to the live floor spine (`/live` namespace). Authenticates
 * the handshake with the stored JWT, subscribes to the requested channel(s), and
 * surfaces a rolling buffer of `LiveEvent`s with a connection `status`.
 * Auto-reconnects (socket.io backoff) and re-subscribes on every (re)connect.
 *
 * Intentionally NOT wired into existing pages yet — only the new "Piso en Vivo"
 * board consumes it. Other areas (operador, planeación, calidad, materiales)
 * adopt it as a documented follow-up so they don't collide with parallel work.
 */
export function useLiveEvents(
  channels: LiveChannel | LiveChannel[],
  opts: UseLiveEventsOptions = {},
) {
  const list = Array.isArray(channels) ? channels : [channels];
  // Stable dependency: a sorted, comma-joined key so a fresh array literal each
  // render doesn't tear down the socket.
  const key = Array.from(new Set(list)).sort().join(',');
  const max = opts.max ?? 50;
  const enabled = opts.enabled !== false;

  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<LiveStatus>('disconnected');
  const [events, setEvents] = useState<LiveEvent[]>([]);

  // Keep the latest onEvent without re-opening the socket.
  const cbRef = useRef(opts.onEvent);
  useEffect(() => {
    cbRef.current = opts.onEvent;
  }, [opts.onEvent]);

  const connect = useCallback(() => {
    if (!enabled || socketRef.current?.connected) return;

    // The WS namespace lives at the server ROOT, not under the HTTP '/api' prefix.
    const apiBase = (
      process.env.NEXT_PUBLIC_API_URL ||
      (typeof window !== 'undefined'
        ? window.location.origin
        : 'http://localhost:3000')
    )
      .replace(/\/$/, '')
      .replace(/\/api$/, '');

    const token =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('axos_access_token')
        : null;

    setStatus('connecting');
    const socket = io(`${apiBase}/live`, {
      transports: ['websocket', 'polling'],
      auth: token ? { token } : {},
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: Infinity,
    });

    const channelList = key ? key.split(',') : [];
    const subscribe = () => socket.emit('subscribe', { channels: channelList });

    socket.on('connect', () => {
      setStatus('connected');
      subscribe();
    });
    // Re-assert the subscription once the server confirms auth.
    socket.on('live:hello', subscribe);
    socket.on('disconnect', () => setStatus('disconnected'));
    socket.on('connect_error', () => setStatus('error'));

    socket.on('live:event', (event: LiveEvent) => {
      setEvents((prev) => {
        if (prev.length && prev[0].id === event.id) return prev; // de-dupe burst
        return [event, ...prev].slice(0, max);
      });
      cbRef.current?.(event);
    });

    socketRef.current = socket;
  }, [enabled, key, max]);

  useEffect(() => {
    connect();
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setStatus('disconnected');
    };
  }, [connect]);

  const clear = useCallback(() => setEvents([]), []);

  return { status, events, lastEvent: events[0] ?? null, clear };
}
