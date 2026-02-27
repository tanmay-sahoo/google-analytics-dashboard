import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isAdmin } from "@/lib/auth-helpers";
import { formatDateShort } from "@/lib/time";
import { fetchGa4EcommerceReport, fetchGa4ProjectReports, fetchGa4ReportDetail } from "@/lib/ga4";
import { getOrRefreshReport } from "@/lib/report-cache";
import { reportDetailMap } from "@/lib/report-config";

type PrefetchPayload = {
  projectId?: string;
  start?: string;
  end?: string;
  force?: boolean;
};

function isValidDate(value?: string) {
  if (!value) {
    return false;
  }
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: PrefetchPayload = {};
  try {
    payload = (await request.json()) as PrefetchPayload;
  } catch (error) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const projectId = payload.projectId;
  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }

  if (!isValidDate(payload.start) || !isValidDate(payload.end)) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  const rangeStart = new Date(payload.start!);
  const rangeEnd = new Date(payload.end!);
  const force = Boolean(payload.force);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { dataSources: true }
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!isAdmin(user.role)) {
    const access = await prisma.projectUser.findUnique({
      where: { projectId_userId: { projectId: project.id, userId: user.id } }
    });
    if (!access) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const ga4Source = project.dataSources.find((item) => item.type === "GA4");
  const ga4Integration = await prisma.integrationSetting.findUnique({
    where: { type: "GA4" }
  });

  if (!ga4Source?.externalId || !ga4Integration?.refreshToken) {
    return NextResponse.json({ error: "GA4 not connected" }, { status: 400 });
  }

  const startDate = formatDateShort(rangeStart);
  const endDate = formatDateShort(rangeEnd);

  const tasks: { key: string; run: () => Promise<unknown> }[] = [
    {
      key: "snapshot",
      run: () =>
        getOrRefreshReport({
          projectId: project.id,
          reportKey: "snapshot",
          rangeStart,
          rangeEnd,
          fetcher: () =>
            fetchGa4ProjectReports({
              propertyId: ga4Source.externalId!,
              refreshToken: ga4Integration.refreshToken!,
              startDate,
              endDate
            }),
          force
        })
    },
    {
      key: "detail:ecommerce-purchases:v2",
      run: () =>
        getOrRefreshReport({
          projectId: project.id,
          reportKey: "detail:ecommerce-purchases:v2",
          rangeStart,
          rangeEnd,
          fetcher: () =>
            fetchGa4EcommerceReport({
              propertyId: ga4Source.externalId!,
              refreshToken: ga4Integration.refreshToken!,
              startDate,
              endDate,
              limit: 100
            }),
          force
        })
    }
  ];

  Object.entries(reportDetailMap).forEach(([key, report]) => {
    tasks.push({
      key: `detail:${key}`,
      run: () =>
        getOrRefreshReport({
          projectId: project.id,
          reportKey: `detail:${key}`,
          rangeStart,
          rangeEnd,
          fetcher: () =>
            fetchGa4ReportDetail({
              propertyId: ga4Source.externalId!,
              refreshToken: ga4Integration.refreshToken!,
              dimension: report.dimension,
              metric: report.metric,
              order: report.order ?? "desc",
              startDate,
              endDate,
              limit: 100
            }),
          force
        })
    });
  });

  const results = await Promise.allSettled(tasks.map((task) => task.run()));
  const failed = results
    .map((result, index) => ({ result, key: tasks[index]?.key }))
    .filter((entry) => entry.result.status === "rejected")
    .map((entry) => entry.key);

  return NextResponse.json({
    ok: true,
    attempted: tasks.length,
    cached: tasks.length - failed.length,
    failed
  });
}
