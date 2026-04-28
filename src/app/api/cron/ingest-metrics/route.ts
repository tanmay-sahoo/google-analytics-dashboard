import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addDays, formatDateShort } from "@/lib/time";
import { fetchGa4DailyMetricsRange } from "@/lib/ga4";
import { fetchAdsDailyMetrics } from "@/lib/google-ads";
import { getSessionUser, isAdmin } from "@/lib/auth-helpers";

function hasValidCronSecret(request: Request, secret: string | undefined) {
  if (!secret) return false;
  const header = request.headers.get("x-cron-secret");
  if (!header) return false;
  const headerBuf = Buffer.from(header);
  const secretBuf = Buffer.from(secret);
  if (headerBuf.length !== secretBuf.length) return false;
  return crypto.timingSafeEqual(headerBuf, secretBuf);
}

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const force = new URL(request.url).searchParams.get("force") === "1";
  if (!hasValidCronSecret(request, cronSecret)) {
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
    error?: string;
  }[] = [];
  let failedProjects = 0;

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

    let ga4Inserted = 0;
    let adsInserted = 0;
    const projectErrors: string[] = [];

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

      const existingGa4Dates = ga4Metrics.length
        ? await prisma.metricDaily.findMany({
            where: {
              projectId: project.id,
              source: "GA4",
              date: { in: ga4Metrics.map((item) => item.date) }
            },
            select: { date: true }
          })
        : [];
      const existingGa4Set = new Set(existingGa4Dates.map((row) => row.date.getTime()));

      for (const item of ga4Metrics) {
        const isNew = !existingGa4Set.has(item.date.getTime());
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
        if (isNew) ga4Inserted += 1;
      }
    } catch (error) {
      projectErrors.push(`GA4: ${error instanceof Error ? error.message : "Ingestion failed"}`);
    }

    if (adsIntegration?.refreshToken && adsSource?.externalId) {
      try {
        const latestAds = await prisma.metricDaily.findFirst({
          where: { projectId: project.id, source: "ADS" },
          orderBy: { date: "desc" }
        });

        let adsStartDate = latestAds ? addDays(latestAds.date, 1) : addDays(endDate, -29);
        if (adsStartDate > endDate) {
          adsStartDate = endDate;
        }

        const adsMetrics =
          adsStartDate <= endDate
            ? await fetchAdsDailyMetrics({
                customerId: adsSource.externalId,
                refreshToken: adsIntegration.refreshToken,
                startDate: formatDateShort(adsStartDate),
                endDate: formatDateShort(endDate)
              })
            : [];

        const existingAdsDates = adsMetrics.length
          ? await prisma.metricDaily.findMany({
              where: {
                projectId: project.id,
                source: "ADS",
                date: { in: adsMetrics.map((item) => item.date) }
              },
              select: { date: true }
            })
          : [];
        const existingAdsSet = new Set(existingAdsDates.map((row) => row.date.getTime()));

        for (const item of adsMetrics) {
          const isNew = !existingAdsSet.has(item.date.getTime());
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
                conversions: item.conversions,
                conversionValue: item.conversionValue,
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
                conversions: item.conversions,
                conversionValue: item.conversionValue,
                roas: item.roas
              }
            }
          });
          if (isNew) adsInserted += 1;
        }
      } catch (error) {
        projectErrors.push(`ADS: ${error instanceof Error ? error.message : "Ingestion failed"}`);
      }
    }

    const projectError = projectErrors.length ? projectErrors.join(" | ") : undefined;
    if (projectError) {
      failedProjects += 1;
    }

    results.push({
      projectId: project.id,
      ga4Inserted,
      adsInserted,
      error: projectError
    });

    await prisma.ingestionProjectLog.update({
      where: { id: projectLog.id },
      data: {
        ga4Inserted,
        adsInserted,
        error: projectError,
        finishedAt: new Date()
      }
    });
  }

  await prisma.ingestionRun.update({
    where: { id: run.id },
    data: {
      status: failedProjects > 0 ? "FAILED" : "COMPLETED",
      finishedAt: new Date(),
      totalProjects: results.length,
      totalGa4: results.reduce((sum, item) => sum + item.ga4Inserted, 0),
      totalAds: results.reduce((sum, item) => sum + item.adsInserted, 0),
      error:
        failedProjects > 0
          ? `${failedProjects} project(s) had ingestion errors.`
          : null
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
