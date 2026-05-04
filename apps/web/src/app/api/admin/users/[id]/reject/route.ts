import { NextResponse } from "next/server";
import { setUserStatus, publicUser } from "@/lib/store";
import { requireAdmin } from "@/lib/guard";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const user = await setUserStatus(id, "rejected");
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  return NextResponse.json({ user: publicUser(user) });
}
