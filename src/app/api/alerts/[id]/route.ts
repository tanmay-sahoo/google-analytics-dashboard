import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isAdmin } from "@/lib/auth-helpers";

const updateSchema = z.object({
  metric: z.string().min(1).optional(),
  scope: z.enum(["PROJECT", "CAMPAIGN"]).optional(),
  filter: z.record(z.any()).optional(),
  condition: z.enum(["GT", "LT", "PCT_CHANGE"]).optional(),
  threshold: z.number().optional(),
  window: z.enum(["TODAY", "YESTERDAY", "LAST_7_DAYS"]).optional(),
  frequency: z.enum(["DAILY_9AM"]).optional(),
  channels: z.record(z.any()).optional(),
  cooldownMins: z.number().int().min(0).optional(),
  enabled: z.boolean().optional()
});

export async function PUT(request: Request, context: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json();
  const parsed = updateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const rule = await prisma.alertRule.findUnique({ where: { id: context.params.id } });
  if (!rule) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!isAdmin(user.role) && rule.createdByUserId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.alertRule.update({
    where: { id: context.params.id },
    data: parsed.data
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, context: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rule = await prisma.alertRule.findUnique({ where: { id: context.params.id } });
  if (!rule) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!isAdmin(user.role) && rule.createdByUserId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.alertRule.delete({ where: { id: context.params.id } });
  return NextResponse.json({ ok: true });
}
