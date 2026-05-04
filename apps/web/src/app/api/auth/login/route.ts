import { NextRequest, NextResponse } from "next/server";
import { findUserByEmail, publicUser, verifyPassword } from "@/lib/store";
import { setSessionCookie } from "@/lib/session";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { email, password } = (body ?? {}) as Record<string, string>;
  if (!email || !password) {
    return NextResponse.json(
      { error: "Email y contraseña son requeridos." },
      { status: 400 },
    );
  }

  const user = await findUserByEmail(email);
  if (!user || !verifyPassword(user, password)) {
    return NextResponse.json(
      { error: "Credenciales inválidas." },
      { status: 401 },
    );
  }

  if (user.status === "pending") {
    return NextResponse.json(
      {
        error:
          "Tu cuenta aún no ha sido aprobada por un administrador.",
        status: "pending",
      },
      { status: 403 },
    );
  }
  if (user.status === "rejected") {
    return NextResponse.json(
      {
        error: "Tu solicitud fue rechazada. Contacta a un administrador.",
        status: "rejected",
      },
      { status: 403 },
    );
  }

  await setSessionCookie({
    kind: "user",
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  });

  return NextResponse.json({ user: publicUser(user) });
}
