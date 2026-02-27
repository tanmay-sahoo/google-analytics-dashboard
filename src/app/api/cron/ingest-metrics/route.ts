import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addDays, formatDateShort } from "@/lib/time";
import { fetchGa4DailyMetricsRange } from "@/lib/ga4";
import { fetchAdsDailyMetrics } from "@/lib/google-ads";
import { getSessionUser, isAdmin } from "@/lib/auth-helpers";

function canRunCron(request: Request, secret: string | undefined) {
  if (!secret) {
    return false;
  }
  const header = request.headers.get("x-cron-secret");
  return header === secret;
}

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const force = new URL(request.url).searchParams.get("force") === "1";
  if (!canRunCron(request, cronSecret)) {
    const user = await getSessionUser();
    if (!user || !isAdmin(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const setting = await prisma.ingestionSetting.findUnique({
    where: { key: "default" }
  });
  if (setting && !setting.enabled && !force) {
    return NextResponse.json({ ok: true, skipped: true, reason: "disabled" });
  }

  const endDate = new Date();
  const ga4Integration = await prisma.integrationSetting.findUnique({
    where: { type: "GA4" }
  });
  const adsIntegration = await prisma.integrationSetting.findUnique({
    where: { type: "ADS" }
  });

  if (!ga4Integration?.refreshToken) {
    return NextResponse.json({ error: "GA4 not connected" }, { status: 400 });
  }

  const projects = await prisma.project.findMany({
    include: { dataSources: true }
  });

  const results: {
    projectId: string;
    ga4Inserted: number;
    adsInserted: number;
  }[] = [];

  const run = await prisma.ingestionRun.create({
    data: {
      status: "STARTED",
      startedAt: new Date()
    }
  });

  for (const project of projects) {
    const ga4Source = project.dataSources.find((item) => item.type === "GA4");
    const adsSource = project.dataSources.find((item) => item.type === "ADS");
    if (!ga4Source?.externalId) {
      continue;
    }

    const projectLog = await prisma.ingestionProjectLog.create({
      data: {
        runId: run.id,
        projectId: project.id,
        startedAt: new Date()
      }
    });

    try {
      const latestGa4 = await prisma.metricDaily.findFirst({
        where: { projectId: project.id, source: "GA4" },
        orderBy: { date: "desc" }
      });

      let startDate = latestGa4 ? addDays(latestGa4.date, 1) : addDays(endDate, -29);
      if (startDate > endDate) {
        startDate = endDate;
      }

      const ga4Metrics =
        startDate <= endDate
          ? await fetchGa4DailyMetricsRange({
              propertyId: ga4Source.externalId,
              refreshToken: ga4Integration.refreshToken,
              startDate: formatDateShort(startDate),
              endDate: formatDateShort(endDate)
            })
          : [];

      for (const item of ga4Metrics) {
        await prisma.metricDaily.upsert({
          where: {
            projectId_date_source: {
              projectId: project.id,
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
            projectId: project.id,
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

      let adsInserted = 0;
      if (adsIntegration?.refreshToken && adsSource?.externalId) {
        const adsMetrics = await fetchAdsDailyMetrics({
          customerId: adsSource.externalId,
          refreshToken: adsIntegration.refreshToken
        });
        for (const item of adsMetrics) {
          await prisma.metricDaily.upsert({
            where: {
              projectId_date_source: {
                projectId: project.id,
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
              projectId: project.id,
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
          adsInserted += 1;
        }
      }

      results.push({
        projectId: project.id,
        ga4Inserted: ga4Metrics.length,
        adsInserted
      });

      await prisma.ingestionProjectLog.update({
        where: { id: projectLog.id },
        data: {
          ga4Inserted: ga4Metrics.length,
          adsInserted,
          finishedAt: new Date()
        }
      });
    } catch (error) {
      await prisma.ingestionProjectLog.update({
        where: { id: projectLog.id },
        data: {
          error: error instanceof Error ? error.message : "Ingestion failed",
          finishedAt: new Date()
        }
      });
    }
  }

  await prisma.ingestionRun.update({
    where: { id: run.id },
    data: {
      status: "COMPLETED",
      finishedAt: new Date(),
      totalProjects: results.length,
      totalGa4: results.reduce((sum, item) => sum + item.ga4Inserted, 0),
      totalAds: results.reduce((sum, item) => sum + item.adsInserted, 0)
    }
  });

  await prisma.ingestionSetting.upsert({
    where: { key: "default" },
    update: { lastRunAt: new Date() },
    create: { key: "default", lastRunAt: new Date() }
  });

  return NextResponse.json({
    ok: true,
    projects: results.length,
    results
  });
}
