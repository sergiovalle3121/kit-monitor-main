import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/guard';
import { backendAdmin } from '@/lib/backendAuth';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const r = await backendAdmin('/auth/pending', 'GET');
  return NextResponse.json({ users: Array.isArray(r.data) ? r.data : [] });
}
