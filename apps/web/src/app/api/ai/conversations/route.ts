import { NextResponse } from 'next/server';
import { backendUserFetch } from '@/lib/backendAuth';

export async function GET() {
  const r = await backendUserFetch('/ai/conversations', 'GET');
  return NextResponse.json(
    Array.isArray(r.data) ? r.data : [],
    { status: r.ok ? 200 : r.status || 502 },
  );
}
