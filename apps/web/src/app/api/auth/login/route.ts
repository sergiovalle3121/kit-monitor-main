import { NextRequest, NextResponse } from 'next/server';
import { findUserByEmail, publicUser, verifyPassword } from '@/lib/store';
import { setSessionCookie } from '@/lib/session';
import { backendLogin, toFrontendRole } from '@/lib/backendAuth';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const { email, password } = (body ?? {}) as Record<string, string>;
  if (!email || !password) {
    return NextResponse.json(
      { error: 'Email y contraseña son requeridos.' },
      { status: 400 },
    );
  }

  // 1) Backend (durable PostgreSQL) — source of truth + per-user identity.
  const be = await backendLogin(email, password);
  if (be.ok) {
    const u = be.data.user;
    const role = toFrontendRole(u.role);
    await setSessionCookie({
      kind: 'user',
      userId: u.id,
      name: u.name ?? u.email,
      email: u.email,
      role,
      position: u.position ?? null,
    });
    return NextResponse.json({
      user: {
        id: u.id,
        name: u.name ?? null,
        email: u.email,
        role,
        position: u.position ?? null,
        status: u.status ?? 'active',
      },
    });
  }

  // 2) Legacy local store fallback (users not yet in the backend).
  const user = await findUserByEmail(email);
  if (user && verifyPassword(user, password)) {
    if (user.status === 'pending') {
      return NextResponse.json(
        { error: 'Tu cuenta aún no ha sido aprobada por un administrador.', status: 'pending' },
        { status: 403 },
      );
    }
    if (user.status === 'rejected') {
      return NextResponse.json(
        { error: 'Tu solicitud fue rechazada. Contacta a un administrador.', status: 'rejected' },
        { status: 403 },
      );
    }
    await setSessionCookie({
      kind: 'user',
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      position: user.position ?? null,
    });
    return NextResponse.json({ user: publicUser(user) });
  }

  // 3) Surface the backend message (invalid / pending / rejected) or generic.
  return NextResponse.json(
    { error: be.message ?? 'Credenciales inválidas.' },
    { status: 401 },
  );
}
