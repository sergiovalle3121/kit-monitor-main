import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ session: null }, { status: 200 });
  }
  return NextResponse.json({
    session: {
      kind: session.kind,
      name: session.name,
      email: session.email ?? null,
      role: session.role,
      userId: session.userId ?? null,
      exp: session.exp,
    },
  });
}
