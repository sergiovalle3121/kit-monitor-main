import { NextRequest, NextResponse } from 'next/server';
import { roleForPosition, SELECTABLE_POSITION_IDS } from '@/config/positions';
import { backendRegister } from '@/lib/backendAuth';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const { name, email, password, position } = (body ?? {}) as Record<string, string>;

  if (!name || !email || !password || !position) {
    return NextResponse.json(
      { error: 'Faltan campos requeridos (incluye tu puesto).' },
      { status: 400 },
    );
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: 'La contraseña debe tener al menos 6 caracteres.' },
      { status: 400 },
    );
  }
  if (!SELECTABLE_POSITION_IDS.has(position)) {
    return NextResponse.json(
      { error: 'Puesto no válido o aún no disponible.' },
      { status: 400 },
    );
  }

  // Register in the backend (durable PostgreSQL); pending until an admin approves.
  const r = await backendRegister({
    name,
    email,
    password,
    position,
    role: roleForPosition(position),
  });
  if (r.ok) {
    return NextResponse.json({
      message:
        r.message ??
        'Tu cuenta fue creada y queda pendiente de aprobación por un administrador.',
    });
  }
  if (r.message && /ya existe/i.test(r.message)) {
    return NextResponse.json(
      { error: 'Ya existe una cuenta con ese correo.' },
      { status: 409 },
    );
  }
  return NextResponse.json(
    { error: r.message ?? 'No se pudo completar el registro.' },
    { status: r.status && r.status >= 400 ? r.status : 500 },
  );
}
