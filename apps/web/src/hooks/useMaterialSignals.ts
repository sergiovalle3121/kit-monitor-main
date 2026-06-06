'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export type MaterialEventName =
  | 'materials:request-created'
  | 'materials:request-authorized'
  | 'materials:request-rejected'
  | 'materials:request-fulfilled';

export interface MaterialRequestEvent {
  event: MaterialEventName;
  id: number;
  kitId: number;
  status: string;
  requestedBy?: string;
  decidedBy?: string;
  workOrder?: string;
  model?: string;
  line?: number;
}

type Status = 'connecting' | 'connected' | 'disconnected' | 'error';

/**
 * Subscribes to the materials pull-system events broadcast by the backend
 * SignalGateway (/signals namespace). `onEvent` fires on every request
 * transition so the warehouse board can refresh in real time.
 */
export function useMaterialSignals(
  onEvent: (e: MaterialRequestEvent) => void,
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
    const apiBase = (
      process.env.NEXT_PUBLIC_API_URL ||
      (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')
    ).replace(/\/$/, '');

    setStatus('connecting');
    const socket = io(`${apiBase}/signals`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 10,
    });

    socket.on('connect', () => {
      setStatus('connected');
      socket.emit('join-tenant', tenantId);
    });
    socket.on('disconnect', () => setStatus('disconnected'));
    socket.on('connect_error', () => setStatus('error'));

    const names: MaterialEventName[] = [
      'materials:request-created',
      'materials:request-authorized',
      'materials:request-rejected',
      'materials:request-fulfilled',
    ];
    names.forEach((name) =>
      socket.on(name, (payload: Omit<MaterialRequestEvent, 'event'>) =>
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
