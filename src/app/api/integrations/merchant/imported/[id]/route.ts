import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isAdmin } from "@/lib/auth-helpers";

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await getSessionUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const merchantId = id;
  await prisma.$transaction([
    prisma.merchantProduct.deleteMany({
      where: { merchantId }
    }),
    prisma.dataSourceAccount.deleteMany({
      where: { type: "MERCHANT", externalId: merchantId }
    }),
    prisma.merchantAccountImport.delete({
      where: { merchantId }
    })
  ]);

  return NextResponse.json({ ok: true });
}
