import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isAdmin } from "@/lib/auth-helpers";
import { logActivity } from "@/lib/logging";

const schema = z.object({
  host: z.string().min(1).max(255),
  port: z.number().int().min(1).max(65535),
  secure: z.boolean(),
  username: z.string().min(1).max(255),
  password: z.string().min(1).max(255).optional(),
  fromEmail: z.string().email(),
  fromName: z.string().max(120).optional().nullable(),
  enabled: z.boolean().optional()
});

export async function GET() {
  const user = await getSessionUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const setting = await prisma.smtpSetting.findUnique({ where: { key: "default" } });
  if (!setting) return NextResponse.json({ smtp: null });
  return NextResponse.json({
    smtp: {
      host: setting.host,
      port: setting.port,
      secure: setting.secure,
      username: setting.username,
      fromEmail: setting.fromEmail,
      fromName: setting.fromName,
      enabled: setting.enabled,
      hasPassword: Boolean(setting.password),
      updatedAt: setting.updatedAt
    }
  });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const existing = await prisma.smtpSetting.findUnique({ where: { key: "default" } });
  const password = parsed.data.password ?? existing?.password;
  if (!password) {
    return NextResponse.json({ error: "Password is required on first save" }, { status: 400 });
  }

  await prisma.smtpSetting.upsert({
    where: { key: "default" },
    update: {
      host: parsed.data.host,
      port: parsed.data.port,
      secure: parsed.data.secure,
      username: parsed.data.username,
      password,
      fromEmail: parsed.data.fromEmail,
      fromName: parsed.data.fromName ?? null,
      enabled: parsed.data.enabled ?? true
    },
    create: {
      key: "default",
      host: parsed.data.host,
      port: parsed.data.port,
      secure: parsed.data.secure,
      username: parsed.data.username,
      password,
      fromEmail: parsed.data.fromEmail,
      fromName: parsed.data.fromName ?? null,
      enabled: parsed.data.enabled ?? true
    }
  });

  await logActivity({
    userId: user.id,
    action: "UPSERT",
    entityType: "SMTP_SETTING",
    message: "Updated SMTP configuration."
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const user = await getSessionUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await prisma.smtpSetting.delete({ where: { key: "default" } }).catch(() => null);
  await logActivity({
    userId: user.id,
    action: "DELETE",
    entityType: "SMTP_SETTING",
    message: "Removed SMTP configuration."
  });
  return NextResponse.json({ ok: true });
}
