import { NextRequest, NextResponse } from 'next/server';
import { backendUserFetch } from '@/lib/backendAuth';

/** Execute a CIDE-proposed action after the user confirmed it (per-user token). */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const r = await backendUserFetch('/ai/actions/execute', 'POST', body);
  return NextResponse.json(r.data ?? { ok: false, error: 'Sin respuesta.' }, {
    status: r.status || 502,
  });
}
