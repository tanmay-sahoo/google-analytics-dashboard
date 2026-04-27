import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isAdmin } from "@/lib/auth-helpers";
import { logActivity } from "@/lib/logging";

const schema = z.object({
  projectId: z.string().min(1),
  type: z.enum(["GA4", "ADS", "MERCHANT"]),
  externalId: z.string().min(2)
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json();
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (!isAdmin(user.role)) {
    const access = await prisma.projectUser.findUnique({
      where: { projectId_userId: { projectId: parsed.data.projectId, userId: user.id } }
    });
    if (!access) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const record = await prisma.dataSourceAccount.upsert({
    where: { projectId_type: { projectId: parsed.data.projectId, type: parsed.data.type } },
    update: { externalId: parsed.data.externalId },
    create: parsed.data
  });

  await logActivity({
    userId: user.id,
    action: "UPSERT",
    entityType: "DATASOURCE",
    entityId: parsed.data.projectId,
    message: `Saved ${parsed.data.type} data source.`,
    metadata: {
      type: parsed.data.type,
      externalId: parsed.data.externalId
    }
  });

  return NextResponse.json({ id: record.id });
}
