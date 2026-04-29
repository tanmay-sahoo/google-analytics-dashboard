import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isAdmin } from "@/lib/auth-helpers";
import { logActivity } from "@/lib/logging";

const MAX_DATA_URI_BYTES = 350 * 1024; // ~256KB raw image
const ALLOWED_MIME = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"];

const updateSchema = z.object({
  logoData: z
    .string()
    .nullable()
    .refine(
      (value) => {
        if (value === null) return true;
        if (typeof value !== "string") return false;
        if (value.length > MAX_DATA_URI_BYTES) return false;
        const match = /^data:([\w/+-]+);base64,/.exec(value);
        if (!match) return false;
        return ALLOWED_MIME.includes(match[1]);
      },
      {
        message: `Invalid image. Use PNG, JPEG, WebP or SVG under ${Math.round(MAX_DATA_URI_BYTES / 1024)}KB.`
      }
    )
});

export async function GET() {
  const setting = await prisma.brandSetting.findUnique({ where: { key: "default" } });
  return NextResponse.json({ logoData: setting?.logoData ?? null });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const payload = await request.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload" },
      { status: 400 }
    );
  }

  await prisma.brandSetting.upsert({
    where: { key: "default" },
    create: { key: "default", logoData: parsed.data.logoData ?? null },
    update: { logoData: parsed.data.logoData ?? null }
  });

  await logActivity({
    userId: user.id,
    action: "UPDATE",
    entityType: "SETTING",
    entityId: "brand",
    message: parsed.data.logoData ? "Updated brand logo." : "Removed brand logo."
  });

  return NextResponse.json({ ok: true });
}
