import { NextRequest, NextResponse } from "next/server";
import { createUser, publicUser } from "@/lib/store";
import { roleForPosition, SELECTABLE_POSITION_IDS } from "@/config/positions";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { name, email, password, position } = (body ?? {}) as Record<string, string>;

  if (!name || !email || !password || !position) {
    return NextResponse.json(
      { error: "Faltan campos requeridos (incluye tu puesto)." },
      { status: 400 },
    );
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "La contraseña debe tener al menos 6 caracteres." },
      { status: 400 },
    );
  }
  if (!SELECTABLE_POSITION_IDS.has(position)) {
    return NextResponse.json(
      { error: "Puesto no válido o aún no disponible." },
      { status: 400 },
    );
  }

  try {
    const user = await createUser({
      name,
      email,
      password,
      role: roleForPosition(position),
      position,
    });
    return NextResponse.json({
      message:
        "Tu cuenta fue creada y queda pendiente de aprobación por un administrador.",
      user: publicUser(user),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "EMAIL_TAKEN") {
      return NextResponse.json(
        { error: "Ya existe una cuenta con ese correo." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
