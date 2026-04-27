import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/signin") || pathname.startsWith("/signup")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/auth/session")) {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token || token.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.next();
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = "/signin";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  if (token.isActive === false) {
    return NextResponse.redirect(new URL("/signin", request.url));
  }

  if (pathname.startsWith("/admin") && token.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const access = Array.isArray(token.menuAccess) ? token.menuAccess : null;
  if (token.role !== "ADMIN" && access && access.length > 0) {
    const map: Array<[string, string]> = [
      ["/dashboard", "dashboard"],
      ["/projects", "projects"],
      ["/ads", "projects"],
      ["/alerts", "alerts"],
      ["/admin/projects", "admin-projects"],
      ["/admin/users", "admin-users"],
      ["/admin/integrations", "admin-integrations"],
      ["/admin/alerts", "admin-alerts"]
    ];
    const matched = map.find(([prefix]) => pathname.startsWith(prefix));
    if (matched && !access.includes(matched[1])) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/projects/:path*", "/ads/:path*", "/alerts/:path*", "/admin/:path*"]
};
