import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isAdmin } from "@/lib/auth-helpers";
import { isValidMetric } from "@/lib/metrics-catalog";

const windowUnitEnum = z.enum(["MINUTES", "HOURS", "DAYS", "WEEKS", "MONTHS"]);
const aggregationEnum = z.enum(["LATEST", "SUM", "AVG"]);

const updateSchema = z.object({
  metric: z.string().min(1).refine(isValidMetric, "Unknown metric").optional(),
  scope: z.enum(["PROJECT", "CAMPAIGN"]).optional(),
  filter: z.record(z.any()).optional(),
  condition: z.enum(["GT", "LT", "PCT_CHANGE"]).optional(),
  threshold: z.number().optional(),
  windowAmount: z.number().int().min(1).max(365).optional(),
  windowUnit: windowUnitEnum.optional(),
  aggregation: aggregationEnum.optional(),
  evaluateEveryMins: z.number().int().min(5).max(10080).optional(),
  channels: z.record(z.any()).optional(),
  cooldownMins: z.number().int().min(0).optional(),
  enabled: z.boolean().optional()
});

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json();
  const parsed = updateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const rule = await prisma.alertRule.findUnique({ where: { id } });
  if (!rule) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!isAdmin(user.role) && rule.createdByUserId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.alertRule.update({
    where: { id },
    data: parsed.data
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rule = await prisma.alertRule.findUnique({ where: { id } });
  if (!rule) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!isAdmin(user.role) && rule.createdByUserId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.alertRule.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
