import { NextResponse } from "next/server";
import { listPendingUsers, publicUser } from "@/lib/store";
import { requireAdmin } from "@/lib/guard";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const users = await listPendingUsers();
  return NextResponse.json({ users: users.map(publicUser) });
}
