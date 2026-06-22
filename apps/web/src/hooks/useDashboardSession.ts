'use client';

import { useSyncExternalStore } from 'react';

/**
 * Sesión "de frontend" (espejo de /api/auth/me). Fuente ÚNICA compartida por la
 * chrome del dashboard (hub, TopBar, Dock, wayfinding) y por Cide/operador, para
 * no disparar el mismo fetch 3-6 veces por página: un solo fetch a nivel de
 * módulo, con suscripción vía useSyncExternalStore (el mismo primitivo que ya
 * usa la TopBar para el flag `mounted`).
 *
 * Es DISTINTO de AuthContext/useAuth (token de backend, roles[]). Aquí se expone
 * la sesión de cookie que la chrome ya consumía (role/email/name/position…), por
 * lo que el gating sigue espejando exactamente al hub.
 */
export interface DashboardSession {
  kind: 'user' | 'demo';
  name: string;
  email: string | null;
  role: string;
  position?: string | null;
  userId: string | null;
  exp?: number;
}

interface SessionState {
  session: DashboardSession | null;
  /** true una vez que /api/auth/me respondió (haya sesión o no). */
  loaded: boolean;
}

let state: SessionState = { session: null, loaded: false };
let started = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function loadOnce() {
  if (started) return;
  started = true;
  fetch('/api/auth/me')
    .then((r) => r.json())
    .then((d) => {
      state = { session: (d?.session as DashboardSession | null) ?? null, loaded: true };
      emit();
    })
    .catch(() => {
      state = { session: null, loaded: true };
      emit();
    });
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  loadOnce();
  return () => {
    listeners.delete(callback);
  };
}

const getSnapshot = () => state;
const getServerSnapshot = () => state;

/** Sesión compartida: un solo fetch a /api/auth/me para toda la app. */
export function useDashboardSession(): SessionState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Actualiza la sesión en memoria (p.ej. tras editar el nombre del perfil) para
 * que todos los consumidores se re-rendericen al instante, sin re-fetch.
 */
export function mutateDashboardSession(
  updater: (s: DashboardSession | null) => DashboardSession | null,
): void {
  state = { session: updater(state.session), loaded: true };
  emit();
}
