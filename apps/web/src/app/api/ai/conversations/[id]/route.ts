import { NextRequest, NextResponse } from 'next/server';
import { backendUserFetch } from '@/lib/backendAuth';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const r = await backendUserFetch(`/ai/conversations/${id}`, 'GET');
  return NextResponse.json(r.data ?? { message: 'No encontrada.' }, {
    status: r.status || 502,
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const r = await backendUserFetch(`/ai/conversations/${id}`, 'DELETE');
  return NextResponse.json(r.data ?? { message: 'No encontrada.' }, {
    status: r.status || 502,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const r = await backendUserFetch(`/ai/conversations/${id}`, 'PATCH', body);
  return NextResponse.json(r.data ?? { message: 'No encontrada.' }, {
    status: r.status || 502,
  });
}
