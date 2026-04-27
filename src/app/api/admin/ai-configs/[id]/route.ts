import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isAdmin } from "@/lib/auth-helpers";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await getSessionUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const provider = typeof body.provider === "string" ? body.provider : undefined;
  const model = typeof body.model === "string" ? body.model : undefined;
  const apiKey = typeof body.apiKey === "string" ? body.apiKey : undefined;
  const isDefault = typeof body.isDefault === "boolean" ? body.isDefault : undefined;

  try {
    if (isDefault) {
      await prisma.aiConfig.updateMany({ data: { isDefault: false } });
    }

    const updated = await prisma.aiConfig.update({
      where: { id },
      data: {
        ...(provider ? { provider } : {}),
        ...(model ? { model } : {}),
        ...(apiKey ? { apiKey } : {}),
        ...(typeof isDefault === "boolean" ? { isDefault } : {})
      }
    });

    if (updated.isDefault) {
      await prisma.aiConfig.updateMany({
        where: { id: { not: updated.id } },
        data: { isDefault: false }
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Failed to update AI config. ${error.message}. Run prisma db push.`
            : "Failed to update AI config. Run prisma db push."
      },
      { status: 500 }
    );
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await getSessionUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const target = await prisma.aiConfig.findUnique({ where: { id } });
    if (!target) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await prisma.aiConfig.delete({ where: { id } });

    if (target.isDefault) {
      const next = await prisma.aiConfig.findFirst({ orderBy: { createdAt: "desc" } });
      if (next) {
        await prisma.aiConfig.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Failed to delete AI config. ${error.message}. Run prisma db push.`
            : "Failed to delete AI config. Run prisma db push."
      },
      { status: 500 }
    );
  }
}
