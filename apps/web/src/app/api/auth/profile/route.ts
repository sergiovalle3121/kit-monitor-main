import { NextResponse } from "next/server";
import { getSession, setSessionCookie } from "@/lib/session";

/**
 * Actualiza el nombre para mostrar del usuario en su sesión (cookie firmada).
 * Cambio inmediato — el saludo del hub y el avatar se actualizan al instante,
 * sin re-login. El default en backend sigue siendo el nombre real del usuario.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { name?: string };
  const name = (body.name ?? "").toString().trim().slice(0, 80);
  if (!name) {
    return NextResponse.json({ error: "El nombre es obligatorio." }, { status: 400 });
  }
  const remaining = Math.max(
    60,
    (session.exp ?? Math.floor(Date.now() / 1000)) - Math.floor(Date.now() / 1000),
  );
  await setSessionCookie(
    {
      kind: session.kind,
      userId: session.userId,
      name,
      email: session.email,
      role: session.role,
      position: session.position ?? null,
    },
    remaining,
  );
  return NextResponse.json({ ok: true, name });
}
