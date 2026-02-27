import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isAdmin } from "@/lib/auth-helpers";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const where = isAdmin(user.role)
    ? {}
    : { project: { projectUsers: { some: { userId: user.id } } } };

  const events = await prisma.alertEvent.findMany({
    where,
    include: { rule: true, project: true },
    orderBy: { evaluatedAt: "desc" }
  });

  return NextResponse.json({ events });
}
