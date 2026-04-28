import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth-helpers";

const schema = z.object({
  ids: z.array(z.string().min(1)).optional(),
  all: z.boolean().optional()
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const now = new Date();
  if (parsed.data.all) {
    await prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: now }
    });
  } else if (parsed.data.ids?.length) {
    await prisma.notification.updateMany({
      where: { userId: user.id, id: { in: parsed.data.ids }, readAt: null },
      data: { readAt: now }
    });
  } else {
    return NextResponse.json({ error: "Nothing to mark" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
