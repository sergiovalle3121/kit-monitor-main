'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export type MesEventName =
  | 'mes:execution-opened'
  | 'mes:step-advanced'
  | 'mes:consumption'
  | 'mes:incident-raised'
  | 'mes:incident-dispositioned'
  | 'mes:andon'
  | 'mes:shortage'
  | 'mes:event-reverted'
  | 'mes:assignment';

export interface MesSignal {
  event: MesEventName;
  executionId?: number;
  stepId?: number;
  workOrder?: string;
  model?: string;
  line?: number;
  [key: string]: unknown;
}

type Status = 'connecting' | 'connected' | 'disconnected' | 'error';

const MES_EVENTS: MesEventName[] = [
  'mes:execution-opened',
  'mes:step-advanced',
  'mes:consumption',
  'mes:incident-raised',
  'mes:incident-dispositioned',
  'mes:andon',
  'mes:shortage',
  'mes:event-reverted',
  'mes:assignment',
];

/**
 * Subscribes to the MES shop-floor events broadcast by the backend
 * SignalGateway (/signals namespace). `onEvent` fires on every station
 * transition / consumption / incident / andon so the operator board can
 * refresh in real time.
 */
export function useMesSignals(
  onEvent: (e: MesSignal) => void,
  tenantId = 'default',
) {
  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<Status>('disconnected');
  const cbRef = useRef(onEvent);
  useEffect(() => {
    cbRef.current = onEvent;
  }, [onEvent]);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;
    // The /signals namespace lives at the server root, NOT under '/api'.
    const apiBase = (
      process.env.NEXT_PUBLIC_API_URL ||
      (typeof window !== 'undefined'
        ? window.location.origin
        : 'http://localhost:3000')
    )
      .replace(/\/$/, '')
      .replace(/\/api$/, '');

    setStatus('connecting');
    // Authenticate the handshake — the gateway derives the tenant from this JWT.
    const token =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('axos_access_token')
        : null;
    const socket = io(`${apiBase}/signals`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 10,
      auth: token ? { token } : {},
    });

    socket.on('connect', () => {
      setStatus('connected');
      socket.emit('join-tenant', tenantId);
    });
    socket.on('disconnect', () => setStatus('disconnected'));
    socket.on('connect_error', () => setStatus('error'));

    MES_EVENTS.forEach((name) =>
      socket.on(name, (payload: Omit<MesSignal, 'event'>) =>
        cbRef.current({ event: name, ...payload }),
      ),
    );

    socketRef.current = socket;
  }, [tenantId]);

  useEffect(() => {
    connect();
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setStatus('disconnected');
    };
  }, [connect]);

  return { status };
}
