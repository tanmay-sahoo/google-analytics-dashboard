import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isAdmin } from "@/lib/auth-helpers";
import { logActivity } from "@/lib/logging";

const schema = z.object({
  accounts: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1)
    })
  )
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = await request.json();
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  let imported = 0;
  for (const account of parsed.data.accounts) {
    await prisma.merchantAccountImport.upsert({
      where: { merchantId: account.id },
      update: { name: account.name },
      create: { merchantId: account.id, name: account.name }
    });
    imported += 1;
  }

  await logActivity({
    userId: user.id,
    action: "IMPORT",
    entityType: "MERCHANT_ACCOUNT",
    message: `Imported ${imported} Merchant accounts.`,
    metadata: { imported }
  });

  return NextResponse.json({ ok: true, imported });
}
