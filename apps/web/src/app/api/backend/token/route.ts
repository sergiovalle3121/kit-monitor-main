import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

/**
 * Backend-token bridge.
 *
 * The frontend gates access with its own cookie session, but the NestJS
 * backend authorizes with a JWT. This route exchanges a valid frontend session
 * for a backend JWT (minted with a service account) so the client's
 * `apiFetch`/`useApi` calls become authenticated.
 *
 * NOTE (pilot simplification): every frontend session currently maps to a
 * single backend service identity. For multi-user RBAC, map the frontend user
 * to a real backend user and mint a per-user token instead.
 */
function backendApiBase(): string {
  let base = (
    process.env.BACKEND_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:3000'
  ).replace(/\/+$/, '');
  if (!base.endsWith('/api')) base += '/api';
  return base;
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'No active session' }, { status: 401 });
  }

  const email = process.env.BACKEND_SERVICE_EMAIL || 'admin@example.com';
  const password = process.env.BACKEND_SERVICE_PASSWORD || '31218223';

  try {
    const res = await fetch(`${backendApiBase()}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: 'Backend login failed', status: res.status },
        { status: 502 },
      );
    }
    const data = await res.json();
    if (!data?.access_token) {
      return NextResponse.json({ error: 'No token returned' }, { status: 502 });
    }
    return NextResponse.json({ access_token: data.access_token });
  } catch {
    return NextResponse.json({ error: 'Backend unreachable' }, { status: 502 });
  }
}
