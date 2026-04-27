import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';

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
  metadata?: Record<string, any>;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

@Injectable({ providedIn: 'root' })
export class SignalsService implements OnDestroy {
  private socket: Socket | null = null;

  private readonly _proposals$      = new Subject<CorrectiveProposal>();
  private readonly _criticalEvents$ = new Subject<CriticalEvent>();
  private readonly _status$         = new BehaviorSubject<ConnectionStatus>('disconnected');

  readonly proposals$:      Observable<CorrectiveProposal> = this._proposals$.asObservable();
  readonly criticalEvents$: Observable<CriticalEvent>      = this._criticalEvents$.asObservable();
  readonly status$:         Observable<ConnectionStatus>   = this._status$.asObservable();

  /**
   * Connects to the SignalGateway WebSocket namespace and joins the tenant room.
   * Safe to call multiple times — only creates one connection.
   */
  connect(tenantId = 'default'): void {
    if (this.socket?.connected) return;

    const rawApi: string = (environment as any).apiUrl ?? '';
    // If apiUrl is relative (e.g. '/api'), derive the backend origin from the current window location.
    // In production the API is co-hosted; in dev the proxy forwards /api → localhost:3000,
    // so we connect the WebSocket directly to the dev API server.
    let apiBase: string;
    if (rawApi.startsWith('http')) {
      // Absolute URL — strip any trailing path (/api) to get the root origin
      try {
        const u = new URL(rawApi);
        apiBase = u.origin;
      } catch {
        apiBase = rawApi;
      }
    } else {
      // Relative — use the current page origin (works in prod where API is same-origin)
      apiBase = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    }

    this._status$.next('connecting');

    this.socket = io(`${apiBase}/signals`, {
      transports:       ['websocket', 'polling'],
      reconnection:     true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 10,
    });

    this.socket.on('connect', () => {
      this._status$.next('connected');
      this.socket?.emit('join-tenant', tenantId);
    });

    this.socket.on('disconnect', () => {
      this._status$.next('disconnected');
    });

    this.socket.on('connect_error', () => {
      this._status$.next('error');
    });

    this.socket.on('signal:new-proposal', (proposal: CorrectiveProposal) => {
      this._proposals$.next(proposal);
    });

    this.socket.on('signal:critical-event', (event: CriticalEvent) => {
      this._criticalEvents$.next(event);
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this._status$.next('disconnected');
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
