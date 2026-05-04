import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/session";

export async function POST() {
  await setSessionCookie(
    {
      kind: "demo",
      name: "Demo Visitor",
      role: "demo",
    },
    60 * 30,
  );
  return NextResponse.json({
    ok: true,
    message: "Sesión demo creada (30 min, solo lectura).",
  });
}
