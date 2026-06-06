import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { backendServiceToken, backendSync } from '@/lib/backendAuth';

/**
 * Backend-token bridge.
 *
 * Exchanges the frontend cookie session for a backend JWT. Mints a PER-USER
 * token: it upserts the real session identity into the backend (durable
 * Postgres user) via /auth/sync and returns that user's JWT, so the backend
 * enforces real per-user RBAC + audit + tenant. Falls back to the shared
 * service identity if sync is unavailable, so the app never hard-breaks.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'No active session' }, { status: 401 });
  }

  if (session.email) {
    const token = await backendSync({
      email: session.email,
      name: session.name,
      role: session.role,
      position: session.position,
    });
    if (token) return NextResponse.json({ access_token: token });
  }

  const svc = await backendServiceToken();
  if (svc) return NextResponse.json({ access_token: svc });
  return NextResponse.json({ error: 'Backend unreachable' }, { status: 502 });
}
