import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/guard';
import { backendUserFetch } from '@/lib/backendAuth';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const r = await backendUserFetch('/ai/config', 'GET');
  return NextResponse.json(r.data ?? {}, { status: r.status || 502 });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => ({}));
  const r = await backendUserFetch('/ai/config', 'POST', body);
  return NextResponse.json(r.data ?? {}, { status: r.status || 502 });
}
