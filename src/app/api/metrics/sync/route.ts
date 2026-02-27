import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fetchGa4DailyMetrics } from "@/lib/ga4";
import { fetchAdsDailyMetrics } from "@/lib/google-ads";
import { getSessionUser, isAdmin } from "@/lib/auth-helpers";
import { logActivity } from "@/lib/logging";

const schema = z.object({
  projectId: z.string().min(1)
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json();
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (!isAdmin(user.role)) {
    const access = await prisma.projectUser.findUnique({
      where: { projectId_userId: { projectId: parsed.data.projectId, userId: user.id } }
    });
    if (!access) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const dataSources = await prisma.dataSourceAccount.findMany({
    where: { projectId: parsed.data.projectId }
  });

  const ga4Source = dataSources.find((item) => item.type === "GA4");
  const adsSource = dataSources.find((item) => item.type === "ADS");

  const [ga4Integration, adsIntegration] = await Promise.all([
    prisma.integrationSetting.findUnique({ where: { type: "GA4" } }),
    prisma.integrationSetting.findUnique({ where: { type: "ADS" } })
  ]);

  if (!ga4Integration?.refreshToken || !ga4Source?.externalId) {
    return NextResponse.json({ error: "GA4 not connected" }, { status: 400 });
  }

  let ga4Metrics = [];
  let adsMetrics = [];

  ga4Metrics = await fetchGa4DailyMetrics({
    propertyId: ga4Source.externalId,
    refreshToken: ga4Integration.refreshToken
  });

  if (adsIntegration?.refreshToken && adsSource?.externalId) {
    adsMetrics = await fetchAdsDailyMetrics({
      customerId: adsSource.externalId,
      refreshToken: adsIntegration.refreshToken
    });
  }

  for (const item of ga4Metrics) {
    await prisma.metricDaily.upsert({
      where: {
        projectId_date_source: {
          projectId: parsed.data.projectId,
          date: item.date,
          source: "GA4"
        }
      },
      update: {
        metrics: {
          sessions: item.sessions,
          users: item.users,
          conversions: item.conversions,
          revenue: item.revenue
        }
      },
      create: {
        projectId: parsed.data.projectId,
        date: item.date,
        source: "GA4",
        metrics: {
          sessions: item.sessions,
          users: item.users,
          conversions: item.conversions,
          revenue: item.revenue
        }
      }
    });
  }

  for (const item of adsMetrics) {
    await prisma.metricDaily.upsert({
      where: {
        projectId_date_source: {
          projectId: parsed.data.projectId,
          date: item.date,
          source: "ADS"
        }
      },
      update: {
        metrics: {
          spend: item.spend,
          clicks: item.clicks,
          impressions: item.impressions,
          roas: item.roas
        }
      },
      create: {
        projectId: parsed.data.projectId,
        date: item.date,
        source: "ADS",
        metrics: {
          spend: item.spend,
          clicks: item.clicks,
          impressions: item.impressions,
          roas: item.roas
        }
      }
    });
  }

  await logActivity({
    userId: user.id,
    action: "SYNC",
    entityType: "METRICS",
    entityId: parsed.data.projectId,
    message: `Synced metrics (${ga4Metrics.length} GA4 days, ${adsMetrics.length} Ads days).`
  });

  return NextResponse.json({ ok: true, ga4Days: ga4Metrics.length, adsDays: adsMetrics.length });
}
