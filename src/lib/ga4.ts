import { google } from "googleapis";
import { getOAuthClient } from "@/lib/google-oauth";
import { addDays, formatDateShort } from "@/lib/time";
import { createLimiter, withRetry } from "@/lib/request-limiter";

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

export type Ga4CityRow = {
  label: string;
  city: string;
  country: string;
  sessions: number;
  users: number;
  conversions: number;
  revenue: number;
};

export type Ga4TopItem = {
  label: string;
  value: number;
};

const ga4Limiter = createLimiter(1);

async function runGa4Report({
  propertyId,
  refreshToken,
  requestBody
}: {
  propertyId: string;
  refreshToken: string;
  requestBody: Record<string, unknown>;
}) {
  const authClient = getOAuthClient();
  authClient.setCredentials({ refresh_token: refreshToken });
  const analyticsData = google.analyticsdata({ version: "v1beta", auth: authClient });
  return ga4Limiter(() =>
    withRetry(
      () =>
        analyticsData.properties.runReport({
          property: `properties/${propertyId}`,
          requestBody
        }),
      { label: "ga4" }
    )
  );
}

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
  const response = await runGa4Report({
    propertyId,
    refreshToken,
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
  const end = new Date();
  const start = addDays(end, -29);

  const response = await runGa4Report({
    propertyId,
    refreshToken,
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
  const campaigns = await runBreakdown({ propertyId, refreshToken, dimension: "campaignName", limit: 10 });
  const sources = await runBreakdown({ propertyId, refreshToken, dimension: "sessionSourceMedium", limit: 10 });
  const devices = await runBreakdown({ propertyId, refreshToken, dimension: "deviceCategory", limit: 10 });

  return { campaigns, sources, devices };
}

export async function fetchGa4CityMetrics({
  propertyId,
  refreshToken,
  startDate,
  endDate,
  limit = 300
}: {
  propertyId: string;
  refreshToken: string;
  startDate: string;
  endDate: string;
  limit?: number;
}): Promise<Ga4CityRow[]> {
  const response = await runGa4Report({
    propertyId,
    refreshToken,
    requestBody: {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "city" }, { name: "country" }],
      metrics: [
        { name: "sessions" },
        { name: "totalUsers" },
        { name: "conversions" },
        { name: "totalRevenue" }
      ],
      orderBys: [{ desc: true, metric: { metricName: "sessions" } }],
      limit
    }
  });

  const rows = response.data.rows ?? [];
  return rows
    .map((row) => {
      const city = row.dimensionValues?.[0]?.value ?? "";
      const country = row.dimensionValues?.[1]?.value ?? "";
      const sessions = Number(row.metricValues?.[0]?.value ?? 0);
      const users = Number(row.metricValues?.[1]?.value ?? 0);
      const conversions = Number(row.metricValues?.[2]?.value ?? 0);
      const revenue = Number(row.metricValues?.[3]?.value ?? 0);
      const trimmedCity = city.trim();
      const trimmedCountry = country.trim();
      const isUnknown =
        !trimmedCity ||
        trimmedCity === "(not set)" ||
        trimmedCity.toLowerCase() === "unknown";
      if (isUnknown) return null;
      const label = trimmedCountry ? `${trimmedCity}, ${trimmedCountry}` : trimmedCity;
      return {
        label,
        city: trimmedCity,
        country: trimmedCountry,
        sessions,
        users,
        conversions,
        revenue
      };
    })
    .filter((row): row is Ga4CityRow => row !== null)
    .filter((row) => row.sessions > 0 || row.users > 0 || row.revenue > 0);
}

async function runTopReport({
  propertyId,
  refreshToken,
  dimension,
  metric,
  limit,
  startDate,
  endDate,
  order = "desc"
}: {
  propertyId: string;
  refreshToken: string;
  dimension: string;
  metric: string;
  limit: number;
  startDate: string;
  endDate: string;
  order?: "asc" | "desc";
}): Promise<Ga4TopItem[]> {
  const response = await runGa4Report({
    propertyId,
    refreshToken,
    requestBody: {
      dateRanges: [{ startDate, endDate }],
      metrics: [{ name: metric }],
      dimensions: [{ name: dimension }],
      orderBys: [{ desc: order === "desc", metric: { metricName: metric } }],
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
  const response = await runGa4Report({
    propertyId,
    refreshToken,
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
  const response = await runGa4Report({
    propertyId,
    refreshToken,
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
  const events = await runTopReport({
    propertyId,
    refreshToken,
    dimension: "eventName",
    metric: "eventCount",
    limit: 8,
    startDate,
    endDate
  });
  const sources = await runTopReport({
    propertyId,
    refreshToken,
    dimension: "sessionSourceMedium",
    metric: "sessions",
    limit: 8,
    startDate,
    endDate
  });
  const landingPages = await runTopReport({
    propertyId,
    refreshToken,
    dimension: "landingPagePlusQueryString",
    metric: "screenPageViews",
    limit: 8,
    startDate,
    endDate
  });
  const userAcquisition = await runTopReport({
    propertyId,
    refreshToken,
    dimension: "firstUserDefaultChannelGroup",
    metric: "newUsers",
    limit: 8,
    startDate,
    endDate
  });
  const sessionAcquisition = await runTopReport({
    propertyId,
    refreshToken,
    dimension: "sessionDefaultChannelGroup",
    metric: "sessions",
    limit: 8,
    startDate,
    endDate
  });
  const countries = await runTopReport({
    propertyId,
    refreshToken,
    dimension: "country",
    metric: "activeUsers",
    limit: 8,
    startDate,
    endDate
  });

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
  const summary = await runSummaryReport({
    propertyId,
    refreshToken,
    metrics: [
      "activeUsers",
      "newUsers",
      "totalUsers",
      "sessions",
      "eventCount",
      "totalRevenue",
      "conversions"
    ],
    startDate,
    endDate
  });
  const engagement = await runSummaryReport({
    propertyId,
    refreshToken,
    metrics: ["engagementRate", "bounceRate", "averageSessionDuration", "sessionsPerUser", "screenPageViews"],
    startDate,
    endDate
  });
  const acquisitionUsers = await runTopReport({
    propertyId,
    refreshToken,
    dimension: "firstUserSourceMedium",
    metric: "newUsers",
    limit: 8,
    startDate,
    endDate
  });
  const acquisitionSessions = await runTopReport({
    propertyId,
    refreshToken,
    dimension: "sessionSourceMedium",
    metric: "sessions",
    limit: 8,
    startDate,
    endDate
  });
  const topPages = await runTopReport({
    propertyId,
    refreshToken,
    dimension: "pagePath",
    metric: "screenPageViews",
    limit: 8,
    startDate,
    endDate
  });
  const topEvents = await runTopReport({
    propertyId,
    refreshToken,
    dimension: "eventName",
    metric: "eventCount",
    limit: 8,
    startDate,
    endDate
  });
  const retentionSeries = await runSeriesReport({
    propertyId,
    refreshToken,
    metrics: ["newUsers", "totalUsers"],
    dimension: "date",
    startDate,
    endDate
  });
  const platform = await runTopReport({
    propertyId,
    refreshToken,
    dimension: "platform",
    metric: "activeUsers",
    limit: 8,
    startDate,
    endDate
  });
  const operatingSystem = await runTopReport({
    propertyId,
    refreshToken,
    dimension: "operatingSystem",
    metric: "activeUsers",
    limit: 8,
    startDate,
    endDate
  });
  const browser = await runTopReport({
    propertyId,
    refreshToken,
    dimension: "browser",
    metric: "activeUsers",
    limit: 8,
    startDate,
    endDate
  });
  const deviceCategory = await runTopReport({
    propertyId,
    refreshToken,
    dimension: "deviceCategory",
    metric: "activeUsers",
    limit: 8,
    startDate,
    endDate
  });
  const platformDevice = await runTopReport({
    propertyId,
    refreshToken,
    dimension: "platformDeviceCategory",
    metric: "activeUsers",
    limit: 8,
    startDate,
    endDate
  });
  const leastPages = await runTopReport({
    propertyId,
    refreshToken,
    dimension: "pagePath",
    metric: "screenPageViews",
    limit: 8,
    startDate,
    endDate,
    order: "asc"
  });
  const searchTerms = await runTopReport({
    propertyId,
    refreshToken,
    dimension: "searchTerm",
    metric: "sessions",
    limit: 8,
    startDate,
    endDate
  });

  return {
    summary: {
      activeUsers: summary.metrics[0] ?? 0,
      newUsers: summary.metrics[1] ?? 0,
      returningUsers: Math.max(0, (summary.metrics[2] ?? 0) - (summary.metrics[1] ?? 0)),
      sessions: summary.metrics[3] ?? 0,
      eventCount: summary.metrics[4] ?? 0,
      totalRevenue: summary.metrics[5] ?? 0,
      conversions: summary.metrics[6] ?? 0
    },
    engagement: {
      engagementRate: engagement.metrics[0] ?? 0,
      bounceRate: engagement.metrics[1] ?? 0,
      averageSessionDuration: engagement.metrics[2] ?? 0,
      sessionsPerUser: engagement.metrics[3] ?? 0,
      pageViews: engagement.metrics[4] ?? 0
    },
    acquisitionUsers,
    acquisitionSessions,
    topPages,
    topEvents,
    leastPages,
    searchTerms,
    retention: {
      dates: retentionSeries.dates,
      newUsers: retentionSeries.series[0] ?? [],
      returningUsers:
        retentionSeries.series[1]?.map((total, index) =>
          Math.max(0, total - (retentionSeries.series[0]?.[index] ?? 0))
        ) ?? []
    },
    tech: {
      platform,
      operatingSystem,
      browser,
      deviceCategory,
      platformDevice
    }
  };
}

export async function fetchGa4ReportDetail({
  propertyId,
  refreshToken,
  dimension,
  metric,
  startDate,
  endDate,
  limit = 100,
  order = "desc"
}: {
  propertyId: string;
  refreshToken: string;
  dimension: string;
  metric: string;
  startDate: string;
  endDate: string;
  limit?: number;
  order?: "asc" | "desc";
}) {
  return runTopReport({
    propertyId,
    refreshToken,
    dimension,
    metric,
    limit,
    startDate,
    endDate,
    order
  });
}

export async function fetchGa4EcommerceReport({
  propertyId,
  refreshToken,
  startDate,
  endDate,
  limit = 100
}: {
  propertyId: string;
  refreshToken: string;
  startDate: string;
  endDate: string;
  limit?: number;
}) {
  async function runItemMetric(metricName: string) {
    try {
      const response = await runGa4Report({
        propertyId,
        refreshToken,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          metrics: [{ name: metricName }],
          dimensions: [{ name: "itemName" }],
          orderBys: [{ desc: true, metric: { metricName } }],
          limit
        }
      });
      const rows = response.data.rows ?? [];
      const values = new Map<string, number>();
      rows.forEach((row) => {
        const label = row.dimensionValues?.[0]?.value ?? "-";
        const value = Number(row.metricValues?.[0]?.value ?? 0);
        values.set(label, value);
      });
      return values;
    } catch (error) {
      return null;
    }
  }

  async function runItemEventCount(eventName: string) {
    try {
      const response = await runGa4Report({
        propertyId,
        refreshToken,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          metrics: [{ name: "eventCount" }],
          dimensions: [{ name: "itemName" }],
          dimensionFilter: {
            filter: {
              fieldName: "eventName",
              stringFilter: {
                matchType: "EXACT",
                value: eventName
              }
            }
          },
          orderBys: [{ desc: true, metric: { metricName: "eventCount" } }],
          limit
        }
      });
      const rows = response.data.rows ?? [];
      const values = new Map<string, number>();
      rows.forEach((row) => {
        const label = row.dimensionValues?.[0]?.value ?? "-";
        const value = Number(row.metricValues?.[0]?.value ?? 0);
        values.set(label, value);
      });
      return values;
    } catch (error) {
      return null;
    }
  }

  try {
    let itemViews =
      (await runItemMetric("itemsViewed")) ??
      (await runItemMetric("itemViews")) ??
      (await runItemMetric("viewItemEventCount")) ??
      (await runItemMetric("itemViewEvents")) ??
      new Map<string, number>();
    if (itemViews.size === 0) {
      itemViews = (await runItemEventCount("view_item")) ?? itemViews;
    }
    const itemsAddedToCart = (await runItemMetric("itemsAddedToCart")) ?? new Map<string, number>();
    const itemsPurchased = (await runItemMetric("itemsPurchased")) ?? new Map<string, number>();
    const itemRevenue = (await runItemMetric("itemRevenue")) ?? new Map<string, number>();

    const labels = new Set<string>();
    [itemViews, itemsAddedToCart, itemsPurchased, itemRevenue].forEach((map) => {
      map.forEach((_value, key) => labels.add(key));
    });

    const mapped = Array.from(labels).map((label) => ({
      label,
      values: [
        itemViews.get(label) ?? 0,
        itemsAddedToCart.get(label) ?? 0,
        itemsPurchased.get(label) ?? 0,
        itemRevenue.get(label) ?? 0
      ]
    }));

    mapped.sort((left, right) => {
      const purchasedDiff = (right.values[2] ?? 0) - (left.values[2] ?? 0);
      if (purchasedDiff !== 0) {
        return purchasedDiff;
      }
      return (right.values[0] ?? 0) - (left.values[0] ?? 0);
    });

    const hasValues = mapped.some((row) => row.values.some((value) => value > 0));
    if (hasValues) {
      return {
        rows: mapped,
        warning: null as string | null,
        mode: "items" as const
      };
    }
  } catch (error) {
    // Ignore errors here and return an empty item-level response below.
  }

  return {
    rows: [],
    warning:
      "Item-level ecommerce metrics are not available for this property or date range.",
    mode: "items" as const
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
  const response = await ga4Limiter(() =>
    withRetry(
      () =>
        analyticsData.properties.runRealtimeReport({
          property: `properties/${String(propertyId)}`,
          requestBody: {
            metrics: [{ name: "activeUsers" }],
            dimensions: [{ name: "country" }],
            orderBys: [{ desc: true, metric: { metricName: "activeUsers" } }],
            limit: "8"
          }
        }),
      { label: "ga4" }
    )
  );

  const rows = response.data.rows ?? [];
  const countries = rows.map((row) => ({
    label: row.dimensionValues?.[0]?.value ?? "-",
    value: Number(row.metricValues?.[0]?.value ?? 0)
  }));
  const activeUsers = countries.reduce((sum, item) => sum + item.value, 0);

  return { activeUsers, countries };
}
