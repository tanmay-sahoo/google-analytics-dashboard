import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isAdmin } from "@/lib/auth-helpers";
import { isValidMetric } from "@/lib/metrics-catalog";

const windowUnitEnum = z.enum(["MINUTES", "HOURS", "DAYS", "WEEKS", "MONTHS"]);
const aggregationEnum = z.enum(["LATEST", "SUM", "AVG"]);

const createSchema = z.object({
  projectId: z.string().min(1),
  metric: z.string().min(1).refine(isValidMetric, "Unknown metric"),
  scope: z.enum(["PROJECT", "CAMPAIGN"]),
  filter: z.record(z.any()).optional(),
  condition: z.enum(["GT", "LT", "PCT_CHANGE"]),
  threshold: z.number(),
  windowAmount: z.number().int().min(1).max(365),
  windowUnit: windowUnitEnum,
  aggregation: aggregationEnum.default("LATEST"),
  evaluateEveryMins: z.number().int().min(5).max(10080).default(60),
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

  const payload = await request.json().catch(() => ({}));
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
