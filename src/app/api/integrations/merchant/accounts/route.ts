import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isAdmin } from "@/lib/auth-helpers";
import { listMerchantAccounts } from "@/lib/merchant";

export async function GET() {
  const user = await getSessionUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const integration = await prisma.integrationSetting.findUnique({
    where: { type: "MERCHANT" }
  });

  if (!integration?.refreshToken) {
    return NextResponse.json({ error: "Merchant not connected" }, { status: 400 });
  }

  const accounts = await listMerchantAccounts(integration.refreshToken);
  return NextResponse.json({ accounts });
}
