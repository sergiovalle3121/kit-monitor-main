/**
 * Server-side helpers to talk to the NestJS backend auth so the backend
 * (PostgreSQL) is the durable source of truth for users. The frontend cookie
 * session still gates the UI, but identity/RBAC/audit live in the backend.
 */

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

/** Shared service-account token (admin) — used for user management + bridge fallback. */
export async function backendServiceToken(): Promise<string | null> {
  const email = process.env.BACKEND_SERVICE_EMAIL || 'admin@example.com';
  const password = process.env.BACKEND_SERVICE_PASSWORD || '31218223';
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
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const token = await backendServiceToken();
  if (!token) return { ok: false, status: 502, data: null };
  try {
    const res = await fetch(`${backendApiBase()}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 502, data: null };
  }
}
