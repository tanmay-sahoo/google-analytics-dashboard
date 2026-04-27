import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isAdmin } from "@/lib/auth-helpers";
import { fetchGa4DailyMetricsRange, fetchGa4Highlights, fetchGa4Realtime } from "@/lib/ga4";
import { addDays, formatDateShort } from "@/lib/time";

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

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { dataSources: true }
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");
  const compare = searchParams.get("compare") === "previous";
  const endDate = endParam ? new Date(endParam) : new Date();
  const startDate = startParam ? new Date(startParam) : addDays(endDate, -29);

  const ga4Integration = await prisma.integrationSetting.findUnique({
    where: { type: "GA4" }
  });
  const ga4Id = project.dataSources.find((item) => item.type === "GA4")?.externalId;

  if (!ga4Integration?.refreshToken || !ga4Id) {
    return NextResponse.json({ error: "GA4 not connected" }, { status: 400 });
  }

  const daily = await fetchGa4DailyMetricsRange({
    propertyId: ga4Id,
    refreshToken: ga4Integration.refreshToken,
    startDate: formatDateShort(startDate),
    endDate: formatDateShort(endDate)
  });

  const dailyMap = new Map(
    daily.map((item) => [item.date.toISOString().slice(0, 10), item])
  );
  const trendDates: string[] = [];
  const trendUsers: number[] = [];
  const trendSessions: number[] = [];
  const trendConversions: number[] = [];
  const trendRevenue: number[] = [];
  for (let cursor = new Date(startDate); cursor <= endDate; cursor = addDays(cursor, 1)) {
    const key = cursor.toISOString().slice(0, 10);
    const value = dailyMap.get(key);
    trendDates.push(key);
    trendUsers.push(Number(value?.users ?? 0));
    trendSessions.push(Number(value?.sessions ?? 0));
    trendConversions.push(Number(value?.conversions ?? 0));
    trendRevenue.push(Number(value?.revenue ?? 0));
  }

  const totals = daily.reduce(
    (acc, item) => {
      acc.sessions += item.sessions;
      acc.users += item.users;
      acc.conversions += item.conversions;
      acc.revenue += item.revenue;
      return acc;
    },
    { sessions: 0, users: 0, conversions: 0, revenue: 0 }
  );

  let realtime = { activeUsers: 0, countries: [] as { label: string; value: number }[] };
  try {
    realtime = await fetchGa4Realtime({
      propertyId: ga4Id,
      refreshToken: ga4Integration.refreshToken
    });
  } catch {
    realtime = { activeUsers: 0, countries: [] };
  }

  let highlights: Awaited<ReturnType<typeof fetchGa4Highlights>> = {
    events: [],
    sources: [],
    landingPages: [],
    userAcquisition: [],
    sessionAcquisition: [],
    countries: []
  };
  try {
    highlights = await fetchGa4Highlights({
      propertyId: ga4Id,
      refreshToken: ga4Integration.refreshToken,
      startDate: formatDateShort(startDate),
      endDate: formatDateShort(endDate)
    });
  } catch {
    highlights = {
      events: [],
      sources: [],
      landingPages: [],
      userAcquisition: [],
      sessionAcquisition: [],
      countries: []
    };
  }

  let comparePayload: null | {
    range: { start: string; end: string };
    kpis: { users: number; sessions: number; conversions: number; revenue: number };
    deltas: { users: number | null; sessions: number | null; conversions: number | null; revenue: number | null };
  } = null;

  if (compare) {
    const rangeDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1);
    const compareEnd = addDays(startDate, -1);
    const compareStart = addDays(compareEnd, -rangeDays + 1);
    const compareDaily = await fetchGa4DailyMetricsRange({
      propertyId: ga4Id,
      refreshToken: ga4Integration.refreshToken,
      startDate: formatDateShort(compareStart),
      endDate: formatDateShort(compareEnd)
    });
    const compareTotals = compareDaily.reduce(
      (acc, item) => {
        acc.sessions += item.sessions;
        acc.users += item.users;
        acc.conversions += item.conversions;
        acc.revenue += item.revenue;
        return acc;
      },
      { sessions: 0, users: 0, conversions: 0, revenue: 0 }
    );

    const delta = (current: number, previous: number) =>
      previous === 0 ? null : ((current - previous) / previous) * 100;

    comparePayload = {
      range: { start: formatDateShort(compareStart), end: formatDateShort(compareEnd) },
      kpis: {
        users: compareTotals.users,
        sessions: compareTotals.sessions,
        conversions: compareTotals.conversions,
        revenue: compareTotals.revenue
      },
      deltas: {
        users: delta(totals.users, compareTotals.users),
        sessions: delta(totals.sessions, compareTotals.sessions),
        conversions: delta(totals.conversions, compareTotals.conversions),
        revenue: delta(totals.revenue, compareTotals.revenue)
      }
    };
  }

  return NextResponse.json({
    currency: project.currency,
    kpis: {
      users: Number(totals.users),
      sessions: Number(totals.sessions),
      conversions: Number(totals.conversions),
      revenue: Number(totals.revenue)
    },
    trend: {
      dates: trendDates,
      users: trendUsers,
      sessions: trendSessions,
      conversions: trendConversions,
      revenue: trendRevenue
    },
    realtime,
    highlights,
    compare: comparePayload
  });
}
