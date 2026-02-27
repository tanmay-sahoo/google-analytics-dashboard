import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isAdmin } from "@/lib/auth-helpers";

const createSchema = z.object({
  projectId: z.string().min(1),
  metric: z.string().min(1),
  scope: z.enum(["PROJECT", "CAMPAIGN"]),
  filter: z.record(z.any()).optional(),
  condition: z.enum(["GT", "LT", "PCT_CHANGE"]),
  threshold: z.number(),
  window: z.enum(["TODAY", "YESTERDAY", "LAST_7_DAYS"]),
  frequency: z.enum(["DAILY_9AM"]),
  channels: z.record(z.any()),
  cooldownMins: z.number().int().min(0),
  enabled: z.boolean().default(true)
});

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const where = isAdmin(user.role)
    ? {}
    : { project: { projectUsers: { some: { userId: user.id } } } };

  const rules = await prisma.alertRule.findMany({
    where,
    include: { project: true },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ rules });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json();
  const parsed = createSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (!isAdmin(user.role)) {
    const access = await prisma.projectUser.findUnique({
      where: {
        projectId_userId: { projectId: parsed.data.projectId, userId: user.id }
      }
    });
    if (!access) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const rule = await prisma.alertRule.create({
    data: {
      ...parsed.data,
      createdByUserId: user.id
    }
  });

  return NextResponse.json({ id: rule.id });
}
