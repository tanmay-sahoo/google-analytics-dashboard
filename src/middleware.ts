import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isSameOrigin } from "@/lib/csrf";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/api/")) return NextResponse.next();
  if (pathname.startsWith("/api/auth/")) return NextResponse.next();
  if (pathname.startsWith("/api/cron/")) return NextResponse.next();
  if (pathname.startsWith("/api/integrations/google/callback")) return NextResponse.next();

  if (!MUTATING.has(request.method)) return NextResponse.next();

  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"]
};
