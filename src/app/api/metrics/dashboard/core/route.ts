import { NextResponse } from "next/server";
import { fetchGa4DailyMetricsRange } from "@/lib/ga4";
import { addDays, formatDateShort } from "@/lib/time";
import { resolveDashboardContext } from "@/lib/dashboard-context";

export async function GET(request: Request) {
  const resolved = await resolveDashboardContext(request);
  if (!resolved.ok) return resolved.response;
  const { ctx } = resolved;
  const { ga4PropertyId, ga4Integration, project, startDate, endDate } = ctx;

  const compare = new URL(request.url).searchParams.get("compare") === "previous";

  const daily = await fetchGa4DailyMetricsRange({
    propertyId: ga4PropertyId,
    refreshToken: ga4Integration.refreshToken!,
    startDate: formatDateShort(startDate),
    endDate: formatDateShort(endDate)
  });

  const dailyMap = new Map(daily.map((item) => [item.date.toISOString().slice(0, 10), item]));
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

  let comparePayload: null | {
    range: { start: string; end: string };
    kpis: { users: number; sessions: number; conversions: number; revenue: number };
    deltas: {
      users: number | null;
      sessions: number | null;
      conversions: number | null;
      revenue: number | null;
    };
  } = null;

  if (compare) {
    const rangeDays = Math.max(
      1,
      Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1
    );
    const compareEnd = addDays(startDate, -1);
    const compareStart = addDays(compareEnd, -rangeDays + 1);
    const compareDaily = await fetchGa4DailyMetricsRange({
      propertyId: ga4PropertyId,
      refreshToken: ga4Integration.refreshToken!,
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
    compare: comparePayload
  });
}
