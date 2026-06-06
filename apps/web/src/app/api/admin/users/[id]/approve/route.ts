import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/guard';
import { backendAdmin } from '@/lib/backendAuth';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const r = await backendAdmin(`/auth/users/${id}/approve`, 'POST');
  if (!r.ok) {
    return NextResponse.json(
      { error: 'No se pudo aprobar al usuario.' },
      { status: r.status || 502 },
    );
  }
  return NextResponse.json({ user: r.data });
}
