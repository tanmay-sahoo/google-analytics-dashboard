import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isAdmin } from "@/lib/auth-helpers";
import { logActivity } from "@/lib/logging";

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(["ADMIN", "USER"]).optional(),
  password: z.string().min(8).optional(),
  isActive: z.boolean().optional(),
  menuAccess: z.array(z.string()).optional(),
  projectIds: z.array(z.string().min(1)).optional()
});

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await getSessionUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = await request.json();
  const parsed = updateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const data: {
    name?: string;
    role?: "ADMIN" | "USER";
    passwordHash?: string;
    isActive?: boolean;
    menuAccess?: string[];
  } = {};
  if (parsed.data.name) data.name = parsed.data.name;
  if (parsed.data.role) data.role = parsed.data.role;
  if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;
  if (parsed.data.menuAccess !== undefined) data.menuAccess = parsed.data.menuAccess;
  if (parsed.data.password) {
    data.passwordHash = await bcrypt.hash(parsed.data.password, 10);
  }

  await prisma.user.update({
    where: { id },
    data
  });

  if (parsed.data.projectIds !== undefined) {
    const desired = new Set(parsed.data.projectIds);
    const existing = await prisma.projectUser.findMany({
      where: { userId: id },
      select: { projectId: true }
    });
    const existingSet = new Set(existing.map((row) => row.projectId));

    const toAdd = parsed.data.projectIds.filter((pid) => !existingSet.has(pid));
    const toRemove = [...existingSet].filter((pid) => !desired.has(pid));

    if (toRemove.length > 0) {
      await prisma.projectUser.deleteMany({
        where: { userId: id, projectId: { in: toRemove } }
      });
    }
    if (toAdd.length > 0) {
      await prisma.projectUser.createMany({
        data: toAdd.map((projectId) => ({ projectId, userId: id })),
        skipDuplicates: true
      });
    }
  }

  await logActivity({
    userId: user.id,
    action: "UPDATE",
    entityType: "USER",
    entityId: id,
    message: "Updated user.",
    metadata: parsed.data.projectIds ? { projectIds: parsed.data.projectIds } : undefined
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await getSessionUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.user.delete({ where: { id } });
  await logActivity({
    userId: user.id,
    action: "DELETE",
    entityType: "USER",
    entityId: id,
    message: "Deleted user."
  });
  return NextResponse.json({ ok: true });
}
