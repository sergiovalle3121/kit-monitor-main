import { NextRequest, NextResponse } from "next/server";
import { listNotifications, markAllNotificationsRead } from "@/lib/store";
import { requireAdmin } from "@/lib/guard";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const unread = req.nextUrl.searchParams.get("unread") === "true";
  const items = await listNotifications({ unreadOnly: unread, limit: 20 });
  return NextResponse.json({ notifications: items });
}

export async function POST() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  await markAllNotificationsRead();
  return NextResponse.json({ ok: true });
}
