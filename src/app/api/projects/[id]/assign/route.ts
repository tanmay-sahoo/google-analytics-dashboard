import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isAdmin } from "@/lib/auth-helpers";

const schema = z.object({
  userIds: z.array(z.string().min(1))
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await getSessionUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = await request.json();
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const projectId = id;

  await prisma.projectUser.deleteMany({ where: { projectId } });
  if (parsed.data.userIds.length > 0) {
    await prisma.projectUser.createMany({
      data: parsed.data.userIds.map((userId) => ({ projectId, userId }))
    });
  }

  return NextResponse.json({ ok: true });
}
