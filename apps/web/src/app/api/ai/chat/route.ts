import { NextRequest, NextResponse } from 'next/server';
import { backendUserFetch } from '@/lib/backendAuth';

/** Proxy a copilot turn to the backend with the current user's per-user token. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const r = await backendUserFetch('/ai/chat', 'POST', body);
  return NextResponse.json(r.data ?? { message: 'Sin respuesta.' }, {
    status: r.status || 200,
  });
}
