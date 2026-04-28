import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isAdmin } from "@/lib/auth-helpers";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 25, 200);
  const onlyUnread = searchParams.get("unread") === "1";
  const scope = searchParams.get("scope");
  const q = (searchParams.get("q") ?? "").trim();
  const kind = searchParams.get("kind");
  const status = searchParams.get("status"); // "all" | "unread" | "read"
  const projectId = searchParams.get("projectId");

  const adminScope = scope === "all" && isAdmin(user.role);

  const where: Prisma.NotificationWhereInput = {};
  if (!adminScope) where.userId = user.id;
  if (onlyUnread || status === "unread") where.readAt = null;
  else if (status === "read") where.readAt = { not: null };
  if (kind && (kind === "ALERT" || kind === "SYSTEM")) where.kind = kind;
  if (projectId) where.projectId = projectId;
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { body: { contains: q, mode: "insensitive" } }
    ];
  }

  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        project: { select: { id: true, name: true } },
        user: adminScope ? { select: { id: true, name: true, email: true } } : false
      }
    }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } })
  ]);

  return NextResponse.json({
    notifications: items.map((n) => {
      const userRel = (n as { user?: { id: string; name: string | null; email: string } | null }).user ?? null;
      return {
        id: n.id,
        title: n.title,
        body: n.body,
        href: n.href,
        kind: n.kind,
        readAt: n.readAt,
        createdAt: n.createdAt,
        project: n.project ? { id: n.project.id, name: n.project.name } : null,
        user: adminScope && userRel ? { id: userRel.id, name: userRel.name, email: userRel.email } : null
      };
    }),
    unreadCount
  });
}
