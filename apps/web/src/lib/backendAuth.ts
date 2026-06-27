/**
 * Server-side helpers to talk to the NestJS backend auth so the backend
 * (PostgreSQL) is the durable source of truth for users. The frontend cookie
 * session still gates the UI, but identity/RBAC/audit live in the backend.
 */

import { getSession } from '@/lib/session';

export interface BackendUser {
  id: string;
  email: string;
  name?: string | null;
  username?: string;
  role: string; // 'Admin' or a frontend RoleId
  position?: string | null;
  permissions?: string[];
  status?: string;
  tenantId?: string | null;
}
interface LoginResult {
  access_token: string;
  user: BackendUser;
}

export function backendApiBase(): string {
  let base = (
    process.env.BACKEND_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:3000'
  ).replace(/\/+$/, '');
  if (!base.endsWith('/api')) base += '/api';
  return base;
}

function keyHeaders(): Record<string, string> {
  const k = process.env.FRONTEND_SHARED_KEY;
  return k ? { 'x-frontend-key': k } : {};
}

/** Backend `role` ('Admin') → frontend RoleId ('admin') for the cookie session. */
export function toFrontendRole(role: string): string {
  return role === 'Admin' ? 'admin' : role;
}

export async function backendLogin(
  email: string,
  password: string,
): Promise<
  { ok: true; data: LoginResult } | { ok: false; status: number; message?: string }
> {
  try {
    const res = await fetch(`${backendApiBase()}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...keyHeaders() },
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
    });
    if (res.ok) return { ok: true, data: (await res.json()) as LoginResult };
    const j = (await res.json().catch(() => ({}))) as { message?: string };
    return { ok: false, status: res.status, message: j.message };
  } catch {
    return { ok: false, status: 0 };
  }
}

export async function backendRegister(payload: {
  name: string;
  email: string;
  password: string;
  position?: string;
  role?: string;
}): Promise<{ ok: boolean; status: number; message?: string }> {
  try {
    const res = await fetch(`${backendApiBase()}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...keyHeaders() },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    const j = (await res.json().catch(() => ({}))) as {
      message?: string;
      error?: string;
    };
    return { ok: res.ok, status: res.status, message: j.message ?? j.error };
  } catch {
    return { ok: false, status: 0, message: 'Backend no disponible.' };
  }
}

/**
 * Service-account password — env only (`BACKEND_SERVICE_PASSWORD`). In production
 * the variable is mandatory: if it is missing we throw a clear error rather than
 * fall back to any public default (fail-closed). Local dev gets an obvious,
 * clearly-insecure placeholder. Must match the backend's value
 * (`apps/api/src/common/config/service-password.ts`) for the service login to work.
 */
function serviceAccountPassword(): string {
  const fromEnv = process.env.BACKEND_SERVICE_PASSWORD?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'BACKEND_SERVICE_PASSWORD es obligatoria; configúrala en el entorno',
    );
  }
  return 'dev-only-change-me';
}

/** Shared service-account token (admin) — used for user management + bridge fallback. */
export async function backendServiceToken(): Promise<string | null> {
  const email = process.env.BACKEND_SERVICE_EMAIL || 'admin@example.com';
  const password = serviceAccountPassword();
  const r = await backendLogin(email, password);
  return r.ok ? r.data.access_token : null;
}

/** Upsert the session identity into the backend → fresh per-user JWT. */
export async function backendSync(identity: {
  email: string;
  name?: string | null;
  role?: string;
  position?: string | null;
  buildingId?: string | null;
}): Promise<string | null> {
  try {
    const res = await fetch(`${backendApiBase()}/auth/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...keyHeaders() },
      body: JSON.stringify(identity),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const j = (await res.json()) as LoginResult;
    return j.access_token;
  } catch {
    return null;
  }
}

/** Authenticated admin call to the backend (user management). */
export async function backendAdmin(
  path: string,
  method: 'GET' | 'POST',
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const token = await backendServiceToken();
  if (!token) return { ok: false, status: 502, data: null };
  try {
    const res = await fetch(`${backendApiBase()}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 502, data: null };
  }
}

/**
 * Mint a PER-USER backend JWT from the current cookie session (same bridge the
 * /api/backend/token route uses) so backend RBAC + tenant scoping apply.
 *
 * En producción NO cae a la identidad de servicio: que una acción de usuario corra
 * como service/admin saltaría RBAC, tenant scoping y auditoría. Si el sync por-usuario
 * falla, retorna null (el caller responde 401 → reautenticación). En dev sí cae al
 * service token para no romper el flujo local.
 */
export async function bridgeToken(): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;
  if (session.email) {
    const t = await backendSync({
      email: session.email,
      name: session.name,
      role: session.role,
      position: session.position,
    });
    if (t) return t;
  }
  if (process.env.NODE_ENV === 'production') return null;
  return backendServiceToken();
}

/** Authenticated backend call using the current user's per-user token. */
export async function backendUserFetch(
  path: string,
  method: 'GET' | 'POST',
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const token = await bridgeToken();
  if (!token) {
    return { ok: false, status: 401, data: { message: 'Sesión no válida.' } };
  }
  try {
    const res = await fetch(`${backendApiBase()}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...keyHeaders(),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch {
    return {
      ok: false,
      status: 502,
      data: { message: 'Backend no disponible.' },
    };
  }
}

/**
 * Authenticated POST that returns the raw streaming `Response` (per-user token),
 * so a route handler can pipe the backend's Server-Sent Events straight to the
 * browser without buffering. Returns null when there is no valid session.
 */
export async function backendUserStream(
  path: string,
  body: unknown,
): Promise<Response | null> {
  const token = await bridgeToken();
  if (!token) return null;
  return fetch(`${backendApiBase()}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...keyHeaders(),
    },
    body: JSON.stringify(body ?? {}),
    cache: 'no-store',
  });
}
