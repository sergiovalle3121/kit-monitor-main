'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

const STORAGE_KEY = 'axos_workspace';

// ── Tipos crudos del backend (lo que devuelven /enterprise/buildings y /programs)
export interface BuildingOption {
  id: string;
  code?: string;
  name: string;
  status?: string;
}

export interface ProjectOption {
  id: string;
  code?: string;
  name: string;
  customer?: { id?: string; name?: string; code?: string } | null;
  dedicatedBuilding?: { id?: string } | null;
}

interface WorkspaceState {
  buildingId: string | null;
  projectId: string | null;
}

interface WorkspaceContextValue extends WorkspaceState {
  /** Edificios accesibles para el usuario (vienen del backend). */
  buildings: BuildingOption[];
  /** Proyectos accesibles para el usuario. */
  projects: ProjectOption[];
  isLoading: boolean;
  error: string | null;
  setWorkspace: (next: { buildingId: string | null; projectId: string | null }) => void;
  clearWorkspace: () => void;
  /** true si el usuario tiene >1 building O >1 project y aún no eligió. */
  needsSelection: boolean;
  reload: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function readStored(): WorkspaceState {
  if (typeof window === 'undefined') return { buildingId: null, projectId: null };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { buildingId: null, projectId: null };
    const parsed = JSON.parse(raw);
    return {
      buildingId: typeof parsed.buildingId === 'string' ? parsed.buildingId : null,
      projectId: typeof parsed.projectId === 'string' ? parsed.projectId : null,
    };
  } catch {
    return { buildingId: null, projectId: null };
  }
}

async function fetchJson<T>(path: string, token: string | null): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`${res.status}`);
  const json = await res.json();
  // Envelope { success, data } o respuesta directa.
  return (json && typeof json === 'object' && 'data' in json && 'success' in json
    ? (json as { data: T }).data
    : (json as T));
}

const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

const EMPTY_STATE: WorkspaceState = { buildingId: null, projectId: null };

/** Suscribe a cambios del localStorage para mantener el estado en sync sin
 *  un setState dentro de un useEffect (que React 19 marca como anti-patrón). */
function subscribeStorage(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', cb);
  return () => window.removeEventListener('storage', cb);
}

let storedSnapshot: WorkspaceState = EMPTY_STATE;
function getStoredSnapshot(): WorkspaceState {
  const next = readStored();
  // Mantén la misma referencia si los valores no cambian (evita rerenders).
  if (next.buildingId === storedSnapshot.buildingId && next.projectId === storedSnapshot.projectId) {
    return storedSnapshot;
  }
  storedSnapshot = next;
  return storedSnapshot;
}
const getServerSnapshot = (): WorkspaceState => EMPTY_STATE;

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const stored = useSyncExternalStore(subscribeStorage, getStoredSnapshot, getServerSnapshot);
  // Override en memoria para que setWorkspace actualice de inmediato sin esperar
  // al evento 'storage' (que no se dispara en la misma pestaña).
  const [override, setOverride] = useState<WorkspaceState | null>(null);
  const state: WorkspaceState = override ?? stored;

  const [buildings, setBuildings] = useState<BuildingOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const token = window.localStorage.getItem('axos_access_token');
    if (!token) {
      setBuildings([]);
      setProjects([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [b, p] = await Promise.all([
        fetchJson<unknown>('/enterprise/buildings', token).catch(() => []),
        fetchJson<unknown>('/enterprise/programs', token).catch(() => []),
      ]);
      setBuildings(asArray<BuildingOption>(b));
      setProjects(asArray<ProjectOption>(p));
    } catch (e) {
      setError((e as Error).message || 'No se pudieron cargar los workspaces.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!active) return;
      await load();
    })();
    return () => {
      active = false;
    };
  }, [load]);

  const setWorkspace = useCallback((next: WorkspaceState) => {
    setOverride(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  }, []);

  const clearWorkspace = useCallback(() => {
    setOverride(EMPTY_STATE);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Filtra proyectos por edificio cuando hay uno seleccionado y un proyecto
  // está "dedicado" a otro edificio.
  const accessibleProjects = useMemo(() => {
    if (!state.buildingId) return projects;
    return projects.filter((p) => {
      const dedicated = p.dedicatedBuilding?.id;
      return !dedicated || dedicated === state.buildingId;
    });
  }, [projects, state.buildingId]);

  const needsSelection = useMemo(() => {
    if (isLoading) return false;
    const manyBuildings = buildings.length > 1;
    const manyProjects = projects.length > 1;
    if (!manyBuildings && !manyProjects) return false; // un solo workspace = no preguntar
    return !state.buildingId && !state.projectId;
  }, [isLoading, buildings.length, projects.length, state]);

  const value: WorkspaceContextValue = {
    buildingId: state.buildingId,
    projectId: state.projectId,
    buildings,
    projects: accessibleProjects,
    isLoading,
    error,
    setWorkspace,
    clearWorkspace,
    needsSelection,
    reload: load,
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used inside <WorkspaceProvider>');
  return ctx;
}
