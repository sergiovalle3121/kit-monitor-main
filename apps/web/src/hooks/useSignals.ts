'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface CorrectiveProposal {
  id: number;
  status: 'pending' | 'executed' | 'dismissed' | 'expired';
  category: 'bottleneck' | 'sigma_instability' | 'shortage' | 'maintenance';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  tenantId: string;
  line?: string;
  model?: string;
  bayId?: number;
  severityScore?: number;
  sigmaLevel?: number;
  executionType?: string;
  createdAt: string;
}

export interface CriticalEvent {
  domain: string;
  action: string;
  referenceId?: string;
  actor?: string;
  line?: string;
  model?: string;
  metadata?: Record<string, unknown>;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export function useSignals(tenantId: string = 'default') {
  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [proposals, setProposals] = useState<CorrectiveProposal[]>([]);
  const [criticalEvents, setCriticalEvents] = useState<CriticalEvent[]>([]);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    // /signals lives at the server root, not under the HTTP '/api' prefix.
    const apiBase = (
      process.env.NEXT_PUBLIC_API_URL ||
      (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')
    )
      .replace(/\/$/, '')
      .replace(/\/api$/, '');

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

    socket.on('disconnect', () => {
      setStatus('disconnected');
    });

    socket.on('connect_error', () => {
      setStatus('error');
    });

    socket.on('signal:new-proposal', (proposal: CorrectiveProposal) => {
      setProposals((prev) => [proposal, ...prev].slice(0, 6));
    });

    socket.on('signal:critical-event', (event: CriticalEvent) => {
      setCriticalEvents((prev) => [event, ...prev].slice(0, 3));
      // Auto-dismiss after 8s
      setTimeout(() => {
        setCriticalEvents((prev) => prev.filter((ev) => ev !== event));
      }, 8000);
    });

    socketRef.current = socket;
  }, [tenantId]);

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setStatus('disconnected');
  }, []);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  const removeProposal = (id: number) => {
    setProposals((prev) => prev.filter((p) => p.id !== id));
  };

  const removeEvent = (event: CriticalEvent) => {
    setCriticalEvents((prev) => prev.filter((e) => e !== event));
  };

  return {
    status,
    proposals,
    setProposals,
    criticalEvents,
    removeProposal,
    removeEvent,
  };
}
