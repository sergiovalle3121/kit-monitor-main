import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/guard';
import { backendUserFetch } from '@/lib/backendAuth';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const r = await backendUserFetch('/ai/usage', 'GET');
  return NextResponse.json(r.data ?? {}, { status: r.status || 502 });
}
