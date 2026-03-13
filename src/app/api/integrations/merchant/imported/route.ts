import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isAdmin } from "@/lib/auth-helpers";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accounts = await prisma.merchantAccountImport.findMany({
    orderBy: { updatedAt: "desc" }
  });

  return NextResponse.json({
    accounts: accounts.map((account) => ({
      id: account.merchantId,
      name: account.name
    }))
  });
}
