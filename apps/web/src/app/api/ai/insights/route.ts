import { NextResponse } from 'next/server';
import { backendUserFetch } from '@/lib/backendAuth';

/** Proactive situation report ("Centinela") for the current user. */
export async function GET() {
  const r = await backendUserFetch('/ai/insights', 'GET');
  return NextResponse.json(r.data ?? { insights: [] }, {
    status: r.status || 502,
  });
}
