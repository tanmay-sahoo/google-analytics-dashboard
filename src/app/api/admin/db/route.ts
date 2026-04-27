import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isAdmin } from "@/lib/auth-helpers";

const TABLES = [
  "User",
  "Project",
  "ProjectUser",
  "DataSourceAccount",
  "IntegrationSetting",
  "MetricDaily",
  "ReportCache",
  "IngestionSetting",
  "ActivityLog",
  "IngestionRun",
  "IngestionProjectLog",
  "MerchantAccountImport",
  "MerchantProduct",
  "AiConfig",
  "AlertRule",
  "AlertEvent"
] as const;

type TableName = (typeof TABLES)[number];

function isTableName(value: string): value is TableName {
  return (TABLES as readonly string[]).includes(value);
}

function toNumber(value: string | null, fallback: number, min: number, max: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function maskSecret(value: string | null | undefined) {
  if (!value) return null;
  if (value.length <= 8) return "********";
  return `${value.slice(0, 4)}...${value.slice(-2)}`;
}

async function getTableRows(table: TableName, skip: number, take: number) {
  if (table === "User") {
    const [total, rows] = await Promise.all([
      prisma.user.count(),
      prisma.user.findMany({
        skip,
        take,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          locale: true,
          theme: true,
          createdById: true,
          createdAt: true
        }
      })
    ]);
    return { total, rows };
  }

  if (table === "Project") {
    const [total, rows] = await Promise.all([
      prisma.project.count(),
      prisma.project.findMany({
        skip,
        take,
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, timezone: true, currency: true, createdAt: true }
      })
    ]);
    return { total, rows };
  }

  if (table === "ProjectUser") {
    const [total, rows] = await Promise.all([
      prisma.projectUser.count(),
      prisma.projectUser.findMany({
        skip,
        take,
        orderBy: { createdAt: "desc" },
        select: { id: true, projectId: true, userId: true, createdAt: true }
      })
    ]);
    return { total, rows };
  }

  if (table === "DataSourceAccount") {
    const [total, rows] = await Promise.all([
      prisma.dataSourceAccount.count(),
      prisma.dataSourceAccount.findMany({
        skip,
        take,
        orderBy: { createdAt: "desc" },
        select: { id: true, projectId: true, type: true, externalId: true, createdAt: true }
      })
    ]);
    return { total, rows };
  }

  if (table === "IntegrationSetting") {
    const [total, rows] = await Promise.all([
      prisma.integrationSetting.count(),
      prisma.integrationSetting.findMany({
        skip,
        take,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          connectedEmail: true,
          tokenExpiresAt: true,
          createdAt: true,
          accessToken: true,
          refreshToken: true
        }
      })
    ]);
    return {
      total,
      rows: rows.map((row) => ({
        ...row,
        accessToken: maskSecret(row.accessToken),
        refreshToken: maskSecret(row.refreshToken)
      }))
    };
  }

  if (table === "MetricDaily") {
    const [total, rows] = await Promise.all([
      prisma.metricDaily.count(),
      prisma.metricDaily.findMany({
        skip,
        take,
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        select: { id: true, projectId: true, date: true, source: true, metrics: true, createdAt: true }
      })
    ]);
    return { total, rows };
  }

  if (table === "ReportCache") {
    const [total, rows] = await Promise.all([
      prisma.reportCache.count(),
      prisma.reportCache.findMany({
        skip,
        take,
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          projectId: true,
          reportKey: true,
          rangeStart: true,
          rangeEnd: true,
          updatedAt: true
        }
      })
    ]);
    return { total, rows };
  }

  if (table === "IngestionSetting") {
    const [total, rows] = await Promise.all([
      prisma.ingestionSetting.count(),
      prisma.ingestionSetting.findMany({
        skip,
        take,
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          key: true,
          enabled: true,
          intervalMins: true,
          lastRunAt: true,
          createdAt: true,
          updatedAt: true
        }
      })
    ]);
    return { total, rows };
  }

  if (table === "ActivityLog") {
    const [total, rows] = await Promise.all([
      prisma.activityLog.count(),
      prisma.activityLog.findMany({
        skip,
        take,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          userId: true,
          action: true,
          entityType: true,
          entityId: true,
          message: true,
          metadata: true,
          createdAt: true
        }
      })
    ]);
    return { total, rows };
  }

  if (table === "IngestionRun") {
    const [total, rows] = await Promise.all([
      prisma.ingestionRun.count(),
      prisma.ingestionRun.findMany({
        skip,
        take,
        orderBy: { startedAt: "desc" },
        select: {
          id: true,
          status: true,
          startedAt: true,
          finishedAt: true,
          totalProjects: true,
          totalGa4: true,
          totalAds: true,
          error: true
        }
      })
    ]);
    return { total, rows };
  }

  if (table === "IngestionProjectLog") {
    const [total, rows] = await Promise.all([
      prisma.ingestionProjectLog.count(),
      prisma.ingestionProjectLog.findMany({
        skip,
        take,
        orderBy: { startedAt: "desc" },
        select: {
          id: true,
          runId: true,
          projectId: true,
          ga4Inserted: true,
          adsInserted: true,
          error: true,
          startedAt: true,
          finishedAt: true
        }
      })
    ]);
    return { total, rows };
  }

  if (table === "MerchantAccountImport") {
    const [total, rows] = await Promise.all([
      prisma.merchantAccountImport.count(),
      prisma.merchantAccountImport.findMany({
        skip,
        take,
        orderBy: { updatedAt: "desc" },
        select: { id: true, merchantId: true, name: true, createdAt: true, updatedAt: true }
      })
    ]);
    return { total, rows };
  }

  if (table === "MerchantProduct") {
    const [total, rows] = await Promise.all([
      prisma.merchantProduct.count(),
      prisma.merchantProduct.findMany({
        skip,
        take,
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          projectId: true,
          merchantId: true,
          offerId: true,
          title: true,
          availability: true,
          priceValue: true,
          priceCurrency: true,
          clicks: true,
          impressions: true,
          sales: true,
          revenue: true,
          performanceAt: true,
          createdAt: true,
          updatedAt: true
        }
      })
    ]);
    return { total, rows };
  }

  if (table === "AiConfig") {
    const [total, rows] = await Promise.all([
      prisma.aiConfig.count(),
      prisma.aiConfig.findMany({
        skip,
        take,
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          provider: true,
          model: true,
          apiKey: true,
          isDefault: true,
          createdAt: true,
          updatedAt: true
        }
      })
    ]);
    return {
      total,
      rows: rows.map((row) => ({ ...row, apiKey: maskSecret(row.apiKey) }))
    };
  }

  if (table === "AlertRule") {
    const [total, rows] = await Promise.all([
      prisma.alertRule.count(),
      prisma.alertRule.findMany({
        skip,
        take,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          projectId: true,
          createdByUserId: true,
          metric: true,
          scope: true,
          condition: true,
          threshold: true,
          window: true,
          frequency: true,
          cooldownMins: true,
          enabled: true,
          createdAt: true
        }
      })
    ]);
    return { total, rows };
  }

  const [total, rows] = await Promise.all([
    prisma.alertEvent.count(),
    prisma.alertEvent.findMany({
      skip,
      take,
      orderBy: { evaluatedAt: "desc" },
      select: {
        id: true,
        ruleId: true,
        projectId: true,
        evaluatedAt: true,
        value: true,
        message: true,
        status: true,
        deliveredAt: true
      }
    })
  ]);
  return { total, rows };
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const requested = searchParams.get("table") ?? TABLES[0];
  if (!isTableName(requested)) {
    return NextResponse.json({ error: "Invalid table name" }, { status: 400 });
  }

  const page = toNumber(searchParams.get("page"), 1, 1, 10000);
  const take = toNumber(searchParams.get("take"), 25, 5, 200);
  const skip = (page - 1) * take;

  const { total, rows } = await getTableRows(requested, skip, take);

  return NextResponse.json({
    tables: TABLES,
    table: requested,
    page,
    take,
    total,
    totalPages: Math.max(1, Math.ceil(total / take)),
    rows
  });
}

