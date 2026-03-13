import { NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export async function POST(_: Request, context: { params: { type: string } }) {
  const user = await getSessionUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const type = context.params.type;
  if (type !== "GA4" && type !== "ADS" && type !== "MERCHANT") {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  await prisma.integrationSetting.delete({ where: { type } }).catch(() => null);

  return NextResponse.redirect(new URL("/admin/integrations", process.env.NEXTAUTH_URL ?? "http://localhost:3000"));
}
