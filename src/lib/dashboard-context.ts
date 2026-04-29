import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isAdmin } from "@/lib/auth-helpers";

type Ctx = {
  user: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;
  project: NonNullable<Awaited<ReturnType<typeof prisma.project.findUnique>>> & {
    dataSources: { type: string; externalId: string | null }[];
  };
  ga4Integration: NonNullable<Awaited<ReturnType<typeof prisma.integrationSetting.findUnique>>>;
  ga4PropertyId: string;
  startDate: Date;
  endDate: Date;
};

export async function resolveDashboardContext(
  request: Request
): Promise<{ ok: true; ctx: Ctx } | { ok: false; response: NextResponse }> {
  const user = await getSessionUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Missing projectId" }, { status: 400 })
    };
  }

  if (!isAdmin(user.role)) {
    const access = await prisma.projectUser.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } }
    });
    if (!access) {
      return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { dataSources: true }
  });
  if (!project) {
    return { ok: false, response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }

  const ga4Integration = await prisma.integrationSetting.findUnique({ where: { type: "GA4" } });
  const ga4PropertyId = project.dataSources.find((d) => d.type === "GA4")?.externalId ?? null;
  if (!ga4Integration?.refreshToken || !ga4PropertyId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "GA4 not connected" }, { status: 400 })
    };
  }

  const endParam = searchParams.get("end");
  const startParam = searchParams.get("start");
  const endDate = endParam ? new Date(endParam) : new Date();
  const startDate = startParam ? new Date(startParam) : new Date(endDate.getTime() - 29 * 86400000);

  return {
    ok: true,
    ctx: {
      user,
      project: project as Ctx["project"],
      ga4Integration,
      ga4PropertyId,
      startDate,
      endDate
    }
  };
}
