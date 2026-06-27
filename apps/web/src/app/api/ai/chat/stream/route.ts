import { NextRequest, NextResponse } from 'next/server';
import { backendUserStream } from '@/lib/backendAuth';

// Server-Sent Events must not be statically optimized or buffered.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Proxy a streaming copilot turn, piping the backend's SSE to the browser. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const upstream = await backendUserStream('/ai/chat/stream', body);

  if (!upstream) {
    return NextResponse.json({ message: 'Sesión no válida.' }, { status: 401 });
  }
  // On a non-stream error (e.g. backend down) forward the JSON body as-is.
  if (!upstream.ok || !upstream.body) {
    const data = await upstream.json().catch(() => ({
      message: 'No se pudo contactar a CIDE.',
    }));
    return NextResponse.json(data, { status: upstream.status || 502 });
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
