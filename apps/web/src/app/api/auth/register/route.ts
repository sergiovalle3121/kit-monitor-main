import { NextRequest, NextResponse } from "next/server";
import { createUser, publicUser, UserRole } from "@/lib/store";

const ROLES: UserRole[] = [
  "admin",
  "engineering",
  "production",
  "quality",
  "inventory",
  "finance",
];

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { name, email, password, role } = (body ?? {}) as Record<string, string>;

  if (!name || !email || !password || !role) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400 },
    );
  }
  if (!ROLES.includes(role as UserRole) || role === "admin") {
    return NextResponse.json(
      { error: "Invalid role. Admin role cannot self-register." },
      { status: 400 },
    );
  }

  try {
    const user = await createUser({
      name,
      email,
      password,
      role: role as UserRole,
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
