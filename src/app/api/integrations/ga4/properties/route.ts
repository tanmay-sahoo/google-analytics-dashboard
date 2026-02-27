import { NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { listGa4Properties } from "@/lib/ga4-admin";

export async function GET() {
  const user = await getSessionUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const integration = await prisma.integrationSetting.findUnique({
    where: { type: "GA4" }
  });

  if (!integration?.refreshToken) {
    return NextResponse.json({ error: "GA4 not connected" }, { status: 400 });
  }

  try {
    const properties = await listGa4Properties(integration.refreshToken);
    return NextResponse.json({ properties });
  } catch (error) {
    const anyError = error as { response?: { data?: { error?: { message?: string } } } };
    const message =
      anyError?.response?.data?.error?.message ??
      (error instanceof Error ? error.message : "Failed to load GA4 properties");
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
