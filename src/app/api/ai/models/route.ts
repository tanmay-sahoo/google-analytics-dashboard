import { NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/auth-helpers";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider") ?? "";
  if (!provider) {
    return NextResponse.json({ error: "Provider is required." }, { status: 400 });
  }
  return NextResponse.json({
    error: "This endpoint is deprecated. Use /api/admin/ai-configs/models instead."
  });
}
