'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';

/**
 * Carril UI-NOTIF — estado de "leído" del centro de notificaciones.
 *
 * ALCANCE: el buzón persistente por-usuario YA existe en servidor
 * (`/notifications`, con estado de leído real que se sincroniza entre
 * dispositivos). Este store local cubre solo las fuentes DERIVADAS del centro
 * (andon/holds/NCR…), que son eventos vivos del piso sin fila propia en el buzón:
 * su estado de leído se guarda POR DISPOSITIVO en localStorage (no se pierde al
 * refrescar y se sincroniza entre pestañas).
 *
 * Implementado con `useSyncExternalStore` (SSR-safe, sin parpadeo de hidratación
 * ni setState-en-effect). Migración futura: cuando exista un read-model por
 * usuario en servidor, este hook se reemplaza conservando la misma interfaz.
 */
const KEY = 'axos_notif_read_v1';
const EMPTY: readonly string[] = [];

// Store en memoria, espejo de localStorage, compartido por los consumidores.
let readIds = new Set<string>();
let snapshot: readonly string[] = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

function recompute(): void {
  snapshot = readIds.size ? [...readIds] : EMPTY;
}
function emit(): void {
  listeners.forEach((l) => l());
}

function readStorage(): Set<string> {
  try {
    const raw = window.localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? (arr as string[]) : []);
  } catch {
    return new Set();
  }
}

function hydrateOnce(): void {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  readIds = readStorage();
  recompute();
}

function persist(): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...readIds]));
  } catch {
    /* cuota llena / modo privado: el estado queda solo en memoria */
  }
}

/** Aplica `fn` al set; si reporta cambios, recalcula snapshot, persiste y notifica. */
function mutate(fn: (set: Set<string>) => boolean): void {
  hydrateOnce();
  if (!fn(readIds)) return;
  recompute();
  persist();
  emit();
}

function subscribe(cb: () => void): () => void {
  hydrateOnce();
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return; // otra pestaña actualizó el estado
    readIds = readStorage();
    recompute();
    emit();
  };
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(cb);
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
  };
}

export interface ReadState {
  isRead: (id: string) => boolean;
  markRead: (ids: string | string[]) => void;
  markUnread: (id: string) => void;
  /** Descarta ids leídos que ya no están vivos para no crecer sin límite. */
  prune: (liveIds: string[]) => void;
}

export function useReadState(): ReadState {
  const ids = useSyncExternalStore(subscribe, () => snapshot, () => EMPTY);
  const set = useMemo(() => new Set(ids), [ids]);

  const isRead = useCallback((id: string) => set.has(id), [set]);

  const markRead = useCallback((arg: string | string[]) => {
    const list = Array.isArray(arg) ? arg : [arg];
    mutate((s) => {
      let changed = false;
      for (const id of list) if (!s.has(id)) { s.add(id); changed = true; }
      return changed;
    });
  }, []);

  const markUnread = useCallback((id: string) => {
    mutate((s) => s.delete(id));
  }, []);

  const prune = useCallback((liveIds: string[]) => {
    // Nunca podar contra una lista vacía: durante la carga inicial items=[] y
    // borraríamos todo el estado de leído por error.
    if (liveIds.length === 0) return;
    const live = new Set(liveIds);
    mutate((s) => {
      let changed = false;
      for (const id of [...s]) if (!live.has(id)) { s.delete(id); changed = true; }
      return changed;
    });
  }, []);

  return { isRead, markRead, markUnread, prune };
}
