import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isAdmin } from "@/lib/auth-helpers";

const updateSchema = z.object({
  enabled: z.boolean(),
  intervalMins: z.number().int().min(15).max(10080)
});

export async function GET() {
  const user = await getSessionUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const setting = await prisma.ingestionSetting.findUnique({
    where: { key: "default" }
  });

  if (!setting) {
    return NextResponse.json({
      enabled: false,
      intervalMins: 1440,
      lastRunAt: null
    });
  }

  return NextResponse.json({
    enabled: setting.enabled,
    intervalMins: setting.intervalMins,
    lastRunAt: setting.lastRunAt
  });
}

export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = await request.json();
  const parsed = updateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const setting = await prisma.ingestionSetting.upsert({
    where: { key: "default" },
    update: {
      enabled: parsed.data.enabled,
      intervalMins: parsed.data.intervalMins
    },
    create: {
      key: "default",
      enabled: parsed.data.enabled,
      intervalMins: parsed.data.intervalMins
    }
  });

  return NextResponse.json({
    enabled: setting.enabled,
    intervalMins: setting.intervalMins,
    lastRunAt: setting.lastRunAt
  });
}
