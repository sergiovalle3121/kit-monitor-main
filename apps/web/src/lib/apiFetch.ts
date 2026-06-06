'use client';

/**
 * Wrapper de fetch que añade automáticamente:
 *   - Authorization: Bearer <jwt>      (del localStorage)
 *   - X-Building-Id: <id>              (del workspace seleccionado)
 *   - X-Project-Id: <id>               (del workspace seleccionado)
 *
 * Cuando el backend implemente el interceptor de contexto, leerá estos
 * headers y filtrará las queries por ellos. Mientras no exista, el backend
 * los ignora silenciosamente — nada se rompe.
 */

const STORAGE_KEY = 'axos_workspace';

function readWorkspace(): { buildingId: string | null; projectId: string | null } {
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

export function withContextHeaders(init?: RequestInit): RequestInit {
  const next: RequestInit = { ...(init || {}) };
  const headers = new Headers(init?.headers);

  if (typeof window !== 'undefined') {
    const token = window.localStorage.getItem('axos_access_token');
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    const ws = readWorkspace();
    if (ws.buildingId) headers.set('X-Building-Id', ws.buildingId);
    if (ws.projectId) headers.set('X-Project-Id', ws.projectId);
  }

  next.headers = headers;
  return next;
}

export function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, withContextHeaders(init));
}
