import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth-helpers";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 25, 100);
  const onlyUnread = searchParams.get("unread") === "1";

  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: {
        userId: user.id,
        ...(onlyUnread ? { readAt: null } : {})
      },
      orderBy: { createdAt: "desc" },
      take: limit
    }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } })
  ]);

  return NextResponse.json({
    notifications: items.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      href: n.href,
      kind: n.kind,
      readAt: n.readAt,
      createdAt: n.createdAt
    })),
    unreadCount
  });
}
