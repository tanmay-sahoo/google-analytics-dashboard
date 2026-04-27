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
  menuAccess: z.array(z.string()).optional()
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

  await logActivity({
    userId: user.id,
    action: "UPDATE",
    entityType: "USER",
    entityId: id,
    message: "Updated user."
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
