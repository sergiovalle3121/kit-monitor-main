import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decodeSession, SESSION_COOKIE_NAME } from "@/lib/session";

const DEMO_BLOCKED_PREFIXES = [
  "/dashboard/admin",
  "/dashboard/settings/users",
];

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await decodeSession(token);
  const path = request.nextUrl.pathname;

  if (!session) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (
    session.kind === "demo" &&
    DEMO_BLOCKED_PREFIXES.some((p) => path.startsWith(p))
  ) {
    const url = new URL("/dashboard", request.url);
    url.searchParams.set("blocked", "demo");
    return NextResponse.redirect(url);
  }

  if (path.startsWith("/dashboard/admin") && session.role !== "admin") {
    const url = new URL("/dashboard", request.url);
    url.searchParams.set("blocked", "admin");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
