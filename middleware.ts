import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Keep this in sync with `basePath` in next.config.js and BASE_PATH in
// src/lib/base-path.ts. middleware.ts lives outside src/ so the @/-alias
// import doesn't resolve here.
const BASE_PATH = "/analytics-app";

// Build a redirect URL that respects the app's basePath. NextResponse.redirect
// is a low-level primitive — it does NOT auto-prepend basePath like
// `<Link>`/`router.push()`/`redirect()` do.
function basePathRedirect(request: NextRequest, target: string) {
  const url = request.nextUrl.clone();
  const path = target.startsWith("/") ? target : `/${target}`;
  url.pathname = `${BASE_PATH}${path}`;
  url.search = "";
  return NextResponse.redirect(url);
}

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
    url.pathname = `${BASE_PATH}/signin`;
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  if (token.isActive === false) {
    return basePathRedirect(request, "/signin");
  }

  if (pathname.startsWith("/admin") && token.role !== "ADMIN") {
    return basePathRedirect(request, "/dashboard");
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
      return basePathRedirect(request, "/dashboard");
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/projects/:path*", "/ads/:path*", "/alerts/:path*", "/admin/:path*"]
};
