import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isAdmin } from "@/lib/auth-helpers";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }

  if (!isAdmin(user.role)) {
    const access = await prisma.projectUser.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } }
    });
    if (!access) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const [ga4, ads] = await Promise.all([
    prisma.metricDaily.findFirst({
      where: { projectId, source: "GA4" },
      orderBy: { date: "desc" }
    }),
    prisma.metricDaily.findFirst({
      where: { projectId, source: "ADS" },
      orderBy: { date: "desc" }
    })
  ]);

  return NextResponse.json({
    ga4: ga4?.metrics ?? null,
    ads: ads?.metrics ?? null
  });
}
