import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/guard';
import { backendAdmin } from '@/lib/backendAuth';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  // The admin chooses the role to grant at approval time (optional). The
  // self-selected role from registration stands if no role is sent.
  let role: string | undefined;
  try {
    const body = await req.json();
    if (body && typeof body.role === 'string') role = body.role;
  } catch {
    /* no body / not JSON — approve keeping the suggested role */
  }
  const r = await backendAdmin(
    `/auth/users/${id}/approve`,
    'POST',
    role ? { role } : undefined,
  );
  if (!r.ok) {
    return NextResponse.json(
      { error: 'No se pudo aprobar al usuario.' },
      { status: r.status || 502 },
    );
  }
  return NextResponse.json({ user: r.data });
}
