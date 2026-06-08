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
  return fetchWithReauth(input, init);
}

// ── Self-healing auth ────────────────────────────────────────────────────────
// If the backend rejects our JWT (401, or 403 from an invalid token) — e.g. the
// JWT secret rotated on Railway or the stored token went stale — re-exchange the
// cookie session for a fresh backend JWT via the bridge and retry the original
// request ONCE. A single in-flight exchange is shared, so a page firing many
// calls at once re-bridges only one time (no stampede, no loops).

const TOKEN_KEY = 'axos_access_token';
const BRIDGE_URL = '/api/backend/token';
let refreshInFlight: Promise<string | null> | null = null;

async function reexchangeToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      window.localStorage.removeItem(TOKEN_KEY);
      const res = await fetch(BRIDGE_URL, { cache: 'no-store' });
      if (!res.ok) return null;
      const data = await res.json().catch(() => null);
      const token = data?.access_token;
      if (typeof token === 'string' && token) {
        window.localStorage.setItem(TOKEN_KEY, token);
        return token;
      }
      return null;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

function reauthEligible(input: RequestInfo | URL): boolean {
  if (typeof window === 'undefined') return false;
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : (input as Request).url ?? '';
  // Never try to self-heal the bridge call itself (would recurse).
  return !url.includes('/backend/token');
}

async function fetchWithReauth(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(input, withContextHeaders(init));
  if ((res.status === 401 || res.status === 403) && reauthEligible(input)) {
    const token = await reexchangeToken();
    if (token) {
      // withContextHeaders re-reads the fresh token from localStorage.
      return fetch(input, withContextHeaders(init));
    }
  }
  return res;
}
