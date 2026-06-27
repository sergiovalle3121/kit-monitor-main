import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/guard';
import { backendUserFetch } from '@/lib/backendAuth';

/** Probe the CIDE inference engine (admin only) — reachability + loaded model. */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const r = await backendUserFetch('/ai/health', 'GET');
  return NextResponse.json(r.data ?? {}, { status: r.status || 502 });
}
