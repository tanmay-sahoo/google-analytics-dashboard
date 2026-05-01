import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isAdmin } from "@/lib/auth-helpers";
import { logActivity } from "@/lib/logging";

const createSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["ADMIN", "USER"]),
  isActive: z.boolean().optional(),
  menuAccess: z.array(z.string()).optional(),
  projectIds: z.array(z.string().min(1)).optional(),
  notificationsEnabled: z.boolean().optional()
});

export async function GET() {
  const user = await getSessionUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      menuAccess: true,
      notificationsEnabled: true,
      createdAt: true,
      createdBy: { select: { id: true, name: true, email: true } },
      projectUsers: { select: { projectId: true } }
    }
  });

  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = await request.json();
  const parsed = createSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  // Admins always receive alert emails — the rule "all admin users get
  // notifications automatically" is enforced server-side so a future client
  // bug can't silently disable it.
  const notificationsEnabled =
    parsed.data.role === "ADMIN" ? true : parsed.data.notificationsEnabled ?? false;
  const created = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      role: parsed.data.role,
      isActive: parsed.data.isActive ?? true,
      menuAccess: parsed.data.menuAccess ?? undefined,
      notificationsEnabled,
      createdById: user.id
    }
  });

  if (parsed.data.projectIds && parsed.data.projectIds.length > 0) {
    await prisma.projectUser.createMany({
      data: parsed.data.projectIds.map((projectId) => ({ projectId, userId: created.id })),
      skipDuplicates: true
    });
  }

  await logActivity({
    userId: user.id,
    action: "CREATE",
    entityType: "USER",
    entityId: created.id,
    message: `Created user ${created.email}.`,
    metadata: parsed.data.projectIds?.length ? { projectIds: parsed.data.projectIds } : undefined
  });

  return NextResponse.json({ id: created.id });
}
