import { google } from "googleapis";
import { getOAuthClient } from "@/lib/google-oauth";
import { addDays, formatDateShort } from "@/lib/time";

export type Ga4DailyMetrics = {
  date: Date;
  sessions: number;
  users: number;
  conversions: number;
  revenue: number;
};

export type Ga4BreakdownRow = {
  label: string;
  sessions: number;
  users: number;
  conversions: number;
  revenue: number;
};

export type Ga4TopItem = {
  label: string;
  value: number;
};

export async function fetchGa4DailyMetrics({
  propertyId,
  refreshToken
}: {
  propertyId: string;
  refreshToken: string;
}): Promise<Ga4DailyMetrics[]> {
  const end = new Date();
  const start = addDays(end, -29);

  return fetchGa4DailyMetricsRange({
    propertyId,
    refreshToken,
    startDate: formatDateShort(start),
    endDate: formatDateShort(end)
  });
}

export async function fetchGa4DailyMetricsRange({
  propertyId,
  refreshToken,
  startDate,
  endDate
}: {
  propertyId: string;
  refreshToken: string;
  startDate: string;
  endDate: string;
}): Promise<Ga4DailyMetrics[]> {
  const authClient = getOAuthClient();
  authClient.setCredentials({ refresh_token: refreshToken });

  const analyticsData = google.analyticsdata({ version: "v1beta", auth: authClient });

  const response = await analyticsData.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dateRanges: [{ startDate, endDate }],
      metrics: [
        { name: "sessions" },
        { name: "totalUsers" },
        { name: "conversions" },
        { name: "totalRevenue" }
      ],
      dimensions: [{ name: "date" }]
    }
  });

  const rows = response.data.rows ?? [];
  return rows.map((row) => {
    const dateValue = row.dimensionValues?.[0]?.value ?? "";
    const year = Number(dateValue.slice(0, 4));
    const month = Number(dateValue.slice(4, 6)) - 1;
    const day = Number(dateValue.slice(6, 8));
    const date = new Date(year, month, day);

    const metrics = row.metricValues ?? [];
    return {
      date,
      sessions: Number(metrics[0]?.value ?? 0),
      users: Number(metrics[1]?.value ?? 0),
      conversions: Number(metrics[2]?.value ?? 0),
      revenue: Number(metrics[3]?.value ?? 0)
    };
  });
}

async function runBreakdown({
  propertyId,
  refreshToken,
  dimension,
  limit
}: {
  propertyId: string;
  refreshToken: string;
  dimension: string;
  limit: number;
}): Promise<Ga4BreakdownRow[]> {
  const authClient = getOAuthClient();
  authClient.setCredentials({ refresh_token: refreshToken });
  const analyticsData = google.analyticsdata({ version: "v1beta", auth: authClient });

  const end = new Date();
  const start = addDays(end, -29);

  const response = await analyticsData.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dateRanges: [{ startDate: formatDateShort(start), endDate: formatDateShort(end) }],
      metrics: [
        { name: "sessions" },
        { name: "totalUsers" },
        { name: "conversions" },
        { name: "totalRevenue" }
      ],
      dimensions: [{ name: dimension }],
      orderBys: [{ desc: true, metric: { metricName: "sessions" } }],
      limit
    }
  });

  const rows = response.data.rows ?? [];
  return rows.map((row) => {
    const label = row.dimensionValues?.[0]?.value ?? "-";
    const metrics = row.metricValues ?? [];
    return {
      label,
      sessions: Number(metrics[0]?.value ?? 0),
      users: Number(metrics[1]?.value ?? 0),
      conversions: Number(metrics[2]?.value ?? 0),
      revenue: Number(metrics[3]?.value ?? 0)
    };
  });
}

export async function fetchGa4Breakdowns({
  propertyId,
  refreshToken
}: {
  propertyId: string;
  refreshToken: string;
}) {
  const [campaigns, sources, devices] = await Promise.all([
    runBreakdown({ propertyId, refreshToken, dimension: "campaignName", limit: 10 }),
    runBreakdown({ propertyId, refreshToken, dimension: "sessionSourceMedium", limit: 10 }),
    runBreakdown({ propertyId, refreshToken, dimension: "deviceCategory", limit: 10 })
  ]);

  return { campaigns, sources, devices };
}

async function runTopReport({
  propertyId,
  refreshToken,
  dimension,
  metric,
  limit,
  startDate,
  endDate
}: {
  propertyId: string;
  refreshToken: string;
  dimension: string;
  metric: string;
  limit: number;
  startDate: string;
  endDate: string;
}): Promise<Ga4TopItem[]> {
  const authClient = getOAuthClient();
  authClient.setCredentials({ refresh_token: refreshToken });
  const analyticsData = google.analyticsdata({ version: "v1beta", auth: authClient });

  const response = await analyticsData.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dateRanges: [{ startDate, endDate }],
      metrics: [{ name: metric }],
      dimensions: [{ name: dimension }],
      orderBys: [{ desc: true, metric: { metricName: metric } }],
      limit
    }
  });

  const rows = response.data.rows ?? [];
  return rows.map((row) => ({
    label: row.dimensionValues?.[0]?.value ?? "-",
    value: Number(row.metricValues?.[0]?.value ?? 0)
  }));
}

async function runSummaryReport({
  propertyId,
  refreshToken,
  metrics,
  startDate,
  endDate,
  dimensions
}: {
  propertyId: string;
  refreshToken: string;
  metrics: string[];
  startDate: string;
  endDate: string;
  dimensions?: string[];
}): Promise<{ dimensions: string[]; metrics: number[] }> {
  const authClient = getOAuthClient();
  authClient.setCredentials({ refresh_token: refreshToken });
  const analyticsData = google.analyticsdata({ version: "v1beta", auth: authClient });

  const response = await analyticsData.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dateRanges: [{ startDate, endDate }],
      metrics: metrics.map((name) => ({ name })),
      dimensions: dimensions?.map((name) => ({ name }))
    }
  });

  const row = response.data.rows?.[0];
  const metricValues = row?.metricValues ?? [];
  const dimensionValues = row?.dimensionValues ?? [];
  return {
    dimensions: dimensionValues.map((value) => value.value ?? ""),
    metrics: metricValues.map((value) => Number(value.value ?? 0))
  };
}

async function runSeriesReport({
  propertyId,
  refreshToken,
  metrics,
  dimension,
  startDate,
  endDate
}: {
  propertyId: string;
  refreshToken: string;
  metrics: string[];
  dimension: string;
  startDate: string;
  endDate: string;
}): Promise<{ dates: string[]; series: number[][] }> {
  const authClient = getOAuthClient();
  authClient.setCredentials({ refresh_token: refreshToken });
  const analyticsData = google.analyticsdata({ version: "v1beta", auth: authClient });

  const response = await analyticsData.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dateRanges: [{ startDate, endDate }],
      metrics: metrics.map((name) => ({ name })),
      dimensions: [{ name: dimension }]
    }
  });

  const rows = response.data.rows ?? [];
  const dates = rows.map((row) => row.dimensionValues?.[0]?.value ?? "");
  const series = metrics.map((_, metricIndex) =>
    rows.map((row) => Number(row.metricValues?.[metricIndex]?.value ?? 0))
  );

  return { dates, series };
}

export async function fetchGa4Highlights({
  propertyId,
  refreshToken,
  startDate,
  endDate
}: {
  propertyId: string;
  refreshToken: string;
  startDate: string;
  endDate: string;
}) {
  const [events, sources, landingPages, userAcquisition, sessionAcquisition, countries] = await Promise.all([
    runTopReport({
      propertyId,
      refreshToken,
      dimension: "eventName",
      metric: "eventCount",
      limit: 8,
      startDate,
      endDate
    }),
    runTopReport({
      propertyId,
      refreshToken,
      dimension: "sessionSourceMedium",
      metric: "sessions",
      limit: 8,
      startDate,
      endDate
    }),
    runTopReport({
      propertyId,
      refreshToken,
      dimension: "landingPagePlusQueryString",
      metric: "screenPageViews",
      limit: 8,
      startDate,
      endDate
    }),
    runTopReport({
      propertyId,
      refreshToken,
      dimension: "firstUserDefaultChannelGroup",
      metric: "newUsers",
      limit: 8,
      startDate,
      endDate
    }),
    runTopReport({
      propertyId,
      refreshToken,
      dimension: "sessionDefaultChannelGroup",
      metric: "sessions",
      limit: 8,
      startDate,
      endDate
    }),
    runTopReport({
      propertyId,
      refreshToken,
      dimension: "country",
      metric: "activeUsers",
      limit: 8,
      startDate,
      endDate
    })
  ]);

  return { events, sources, landingPages, userAcquisition, sessionAcquisition, countries };
}

export async function fetchGa4ProjectReports({
  propertyId,
  refreshToken,
  startDate,
  endDate
}: {
  propertyId: string;
  refreshToken: string;
  startDate: string;
  endDate: string;
}) {
  const [summary, engagement, acquisitionUsers, acquisitionSessions, topPages, topEvents, retentionSeries] =
    await Promise.all([
      runSummaryReport({
        propertyId,
        refreshToken,
        metrics: [
          "activeUsers",
          "newUsers",
          "returningUsers",
          "sessions",
          "eventCount",
          "totalRevenue",
          "purchaseRevenue",
          "ecommercePurchases"
        ],
        startDate,
        endDate
      }),
      runSummaryReport({
        propertyId,
        refreshToken,
        metrics: ["averageEngagementTime", "screenPageViews"],
        startDate,
        endDate
      }),
      runTopReport({
        propertyId,
        refreshToken,
        dimension: "firstUserDefaultChannelGroup",
        metric: "newUsers",
        limit: 8,
        startDate,
        endDate
      }),
      runTopReport({
        propertyId,
        refreshToken,
        dimension: "sessionDefaultChannelGroup",
        metric: "sessions",
        limit: 8,
        startDate,
        endDate
      }),
      runTopReport({
        propertyId,
        refreshToken,
        dimension: "pageTitle",
        metric: "screenPageViews",
        limit: 8,
        startDate,
        endDate
      }),
      runTopReport({
        propertyId,
        refreshToken,
        dimension: "eventName",
        metric: "eventCount",
        limit: 8,
        startDate,
        endDate
      }),
      runSeriesReport({
        propertyId,
        refreshToken,
        metrics: ["newUsers", "returningUsers"],
        dimension: "date",
        startDate,
        endDate
      })
    ]);

  return {
    summary: {
      activeUsers: summary.metrics[0] ?? 0,
      newUsers: summary.metrics[1] ?? 0,
      returningUsers: summary.metrics[2] ?? 0,
      sessions: summary.metrics[3] ?? 0,
      eventCount: summary.metrics[4] ?? 0,
      totalRevenue: summary.metrics[5] ?? 0,
      purchaseRevenue: summary.metrics[6] ?? 0,
      ecommercePurchases: summary.metrics[7] ?? 0
    },
    engagement: {
      avgEngagementTime: engagement.metrics[0] ?? 0,
      pageViews: engagement.metrics[1] ?? 0
    },
    acquisitionUsers,
    acquisitionSessions,
    topPages,
    topEvents,
    retention: {
      dates: retentionSeries.dates,
      newUsers: retentionSeries.series[0] ?? [],
      returningUsers: retentionSeries.series[1] ?? []
    }
  };
}

export async function fetchGa4Realtime({
  propertyId,
  refreshToken
}: {
  propertyId: string;
  refreshToken: string;
}): Promise<{ activeUsers: number; countries: { label: string; value: number }[] }> {
  const authClient = getOAuthClient();
  authClient.setCredentials({ refresh_token: refreshToken });
  const analyticsData = google.analyticsdata({ version: "v1beta", auth: authClient });

  const response = await analyticsData.properties.runRealtimeReport({
    property: `properties/${propertyId}`,
    requestBody: {
      metrics: [{ name: "activeUsers" }],
      dimensions: [{ name: "country" }],
      orderBys: [{ desc: true, metric: { metricName: "activeUsers" } }],
      limit: 8
    }
  });

  const rows = response.data.rows ?? [];
  const countries = rows.map((row) => ({
    label: row.dimensionValues?.[0]?.value ?? "-",
    value: Number(row.metricValues?.[0]?.value ?? 0)
  }));
  const activeUsers = countries.reduce((sum, item) => sum + item.value, 0);

  return { activeUsers, countries };
}
