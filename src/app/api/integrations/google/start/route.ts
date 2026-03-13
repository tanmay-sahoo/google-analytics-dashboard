import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildAuthUrl } from "@/lib/google-oauth";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") as "GA4" | "ADS" | "MERCHANT" | null;

  if (type !== "GA4" && type !== "ADS" && type !== "MERCHANT") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const authUrl = buildAuthUrl(type);
  return NextResponse.redirect(authUrl);
}
