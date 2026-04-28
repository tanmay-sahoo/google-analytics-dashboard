import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addDays, formatDateShort } from "@/lib/time";
import ProjectDetailClient from "@/components/ProjectDetailClient";
import Tabs from "@/components/Tabs";
import PaginatedTable from "@/components/PaginatedTable";
import ProjectLogsDateFilter from "@/components/ProjectLogsDateFilter";

type ProjectDetailTab = "storage" | "rows" | "ingestion" | "activity";
const PROJECT_DETAIL_TABS: ProjectDetailTab[] = ["storage", "rows", "ingestion", "activity"];

type LogsRangeKey = "last7" | "last30" | "last90" | "month" | "custom";
const LOGS_RANGE_KEYS: LogsRangeKey[] = ["last7", "last30", "last90", "month", "custom"];

function resolveLogsRange(range: LogsRangeKey, startParam?: string, endParam?: string) {
  const end = endParam ? new Date(endParam) : new Date();
  let start = startParam ? new Date(startParam) : addDays(end, -29);
  if (range === "last7") start = addDays(end, -6);
  else if (range === "last30") start = addDays(end, -29);
  else if (range === "last90") start = addDays(end, -89);
  else if (range === "month") start = new Date(end.getFullYear(), end.getMonth(), 1);
  return { start, end };
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function formatDateTime(value: Date | null | undefined) {
  if (!value) return "-";
  return `${value.toISOString().slice(0, 19).replace("T", " ")} UTC`;
}

function metricValueToText(value: unknown) {
  if (typeof value === "number") {
    if (Number.isInteger(value)) return value.toLocaleString();
    return value.toFixed(2);
  }
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value === null || value === undefined) return "-";
  return JSON.stringify(value);
}

function summarizeJson(value: unknown, limit = 4) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "-";
  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.length) return "-";
  return entries
    .slice(0, limit)
    .map(([key, current]) => `${key}: ${metricValueToText(current)}`)
    .join(" | ");
}

function summarizeMetadata(value: unknown) {
  if (!value) return "-";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > 220 ? `${text.slice(0, 220)}...` : text;
}

export default async function ProjectDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    tab?: string;
    range?: string;
    start?: string;
    end?: string;
  }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const session = await getServerSession(authOptions);
  const user = session?.user;

  if (!user) {
    return null;
  }

  const project = await prisma.project.findUnique({
    where: { id: resolvedParams.id },
    include: { dataSources: true }
  });

  if (!project) {
    return notFound();
  }

  if (user.role !== "ADMIN") {
    const access = await prisma.projectUser.findUnique({
      where: { projectId_userId: { projectId: project.id, userId: user.id } }
    });
    if (!access) {
      return notFound();
    }
  }

  const requestedRange = resolvedSearchParams?.range as LogsRangeKey | undefined;
  const rangeKey: LogsRangeKey =
    requestedRange && LOGS_RANGE_KEYS.includes(requestedRange) ? requestedRange : "last30";
  const { start: rangeStart, end: rangeEnd } = resolveLogsRange(
    rangeKey,
    resolvedSearchParams?.start,
    resolvedSearchParams?.end
  );
  const rangeStartDay = startOfDay(rangeStart);
  const rangeEndDay = endOfDay(rangeEnd);

  const [ga4Metrics, adsMetrics] = await Promise.all([
    prisma.metricDaily.groupBy({
      by: ["source"],
      where: { projectId: project.id },
      _count: { _all: true },
      _max: { date: true, createdAt: true }
    }),
    prisma.metricDaily.findMany({
      where: {
        projectId: project.id,
        date: { gte: rangeStartDay, lte: rangeEndDay }
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 200
    })
  ]);

  const ga4Source = project.dataSources.find((item) => item.type === "GA4");
  const adsSource = project.dataSources.find((item) => item.type === "ADS");
  const merchantSource = project.dataSources.find((item) => item.type === "MERCHANT");
  const ga4Id = ga4Source?.externalId;
  const adsId = adsSource?.externalId;
  const merchantId = merchantSource?.externalId;
  const assignedMerchants = await prisma.dataSourceAccount.findMany({
    where: { type: "MERCHANT", projectId: { not: project.id } },
    select: { externalId: true }
  });
  const assignedMerchantIds = Array.from(
    new Set(assignedMerchants.map((item) => item.externalId).filter(Boolean))
  );

  const [ingestionLogs, activityLogs] = await Promise.all([
    prisma.ingestionProjectLog.findMany({
      where: {
        projectId: project.id,
        startedAt: { gte: rangeStartDay, lte: rangeEndDay }
      },
      orderBy: { startedAt: "desc" },
      take: 200,
      include: {
        run: {
          select: {
            id: true,
            status: true,
            startedAt: true,
            finishedAt: true,
            error: true
          }
        }
      }
    }),
    prisma.activityLog.findMany({
      where: {
        entityId: project.id,
        entityType: { in: ["METRICS", "DATASOURCE", "PROJECT"] },
        createdAt: { gte: rangeStartDay, lte: rangeEndDay }
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { user: { select: { id: true, name: true, email: true } } }
    })
  ]);

  const requestedTab = resolvedSearchParams?.tab as ProjectDetailTab | undefined;
  const activeTab: ProjectDetailTab =
    requestedTab && PROJECT_DETAIL_TABS.includes(requestedTab) ? requestedTab : "storage";
  const filterParams = new URLSearchParams({
    range: rangeKey,
    start: formatDateShort(rangeStart),
    end: formatDateShort(rangeEnd)
  });
  const tabHref = (key: string) => {
    const params = new URLSearchParams(filterParams);
    params.set("tab", key);
    return `/projects/${project.id}?${params.toString()}`;
  };
  const totalStoredRows = ga4Metrics.reduce((acc, item) => acc + item._count._all, 0);
  const tabItems = [
    { key: "storage", label: "Storage summary", count: totalStoredRows },
    { key: "rows", label: "Fetched rows", count: adsMetrics.length },
    { key: "ingestion", label: "Ingestion logs", count: ingestionLogs.length },
    { key: "activity", label: "API activity", count: activityLogs.length }
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">{project.name}</h1>
        <p className="text-sm text-slate/60">{project.timezone} - {project.currency}</p>
      </div>

      <ProjectDetailClient
        projectId={project.id}
        ga4Id={ga4Id}
        adsId={adsId}
        merchantId={merchantId}
        assignedMerchantIds={assignedMerchantIds}
        projectName={project.name}
        role={user.role}
      />

      <div className="space-y-4">
        <ProjectLogsDateFilter
          projectId={project.id}
          tab={activeTab}
          range={rangeKey}
          start={formatDateShort(rangeStart)}
          end={formatDateShort(rangeEnd)}
          urlHadRange={Boolean(resolvedSearchParams?.range)}
        />
        <Tabs
          ariaLabel="Project data tables"
          items={tabItems}
          activeKey={activeTab}
          buildHref={tabHref}
        />

        {activeTab === "storage" && (
          <div className="card space-y-4">
            <div>
              <div className="label">Source storage summary</div>
              <p className="text-sm text-slate/60">Latest stored rows per source from your database.</p>
            </div>
            <PaginatedTable
              columns={[
                { label: "Source" },
                { label: "Total rows", align: "right" },
                { label: "Last metric date" },
                { label: "Last fetched at" }
              ]}
              rows={ga4Metrics.map((item) => [
                item.source,
                item._count._all.toLocaleString(),
                item._max.date ? formatDateShort(item._max.date) : "-",
                formatDateTime(item._max.createdAt)
              ])}
              emptyMessage="No metric rows saved yet."
            />
          </div>
        )}

        {activeTab === "rows" && (
          <div className="card space-y-4">
            <div>
              <div className="label">Latest fetched data rows</div>
              <p className="text-sm text-slate/60">Recent per-day metric rows persisted for this project.</p>
            </div>
            <PaginatedTable
              searchable
              searchPlaceholder="Search source or fields..."
              columns={[
                { label: "Source" },
                { label: "Metric date" },
                { label: "Fetched at" },
                { label: "Fetched fields" }
              ]}
              rows={adsMetrics.map((row) => [
                row.source,
                formatDateShort(row.date),
                formatDateTime(row.createdAt),
                summarizeJson(row.metrics, 6)
              ])}
              emptyMessage="No fetched metric rows yet."
            />
          </div>
        )}

        {activeTab === "ingestion" && (
          <div className="card space-y-4">
            <div>
              <div className="label">Ingestion fetch logs</div>
              <p className="text-sm text-slate/60">Scheduled/cron ingestion history for this project.</p>
            </div>
            <PaginatedTable
              columns={[
                { label: "Run started" },
                { label: "Run status" },
                { label: "Project fetch started" },
                { label: "Project fetch finished" },
                { label: "GA4 rows", align: "right" },
                { label: "Ads rows", align: "right" },
                { label: "Error" }
              ]}
              rows={ingestionLogs.map((log) => [
                formatDateTime(log.run.startedAt),
                log.run.status,
                formatDateTime(log.startedAt),
                formatDateTime(log.finishedAt),
                log.ga4Inserted,
                log.adsInserted,
                log.error ?? log.run.error ?? "-"
              ])}
              emptyMessage="No ingestion logs yet."
            />
          </div>
        )}

        {activeTab === "activity" && (
          <div className="card space-y-4">
            <div>
              <div className="label">API activity logs</div>
              <p className="text-sm text-slate/60">Manual/source API actions with fetched metadata snapshots.</p>
            </div>
            <PaginatedTable
              searchable
              searchPlaceholder="Search action, entity, or message..."
              columns={[
                { label: "Time" },
                { label: "User" },
                { label: "Action" },
                { label: "Entity" },
                { label: "Message" },
                { label: "Metadata" }
              ]}
              rows={activityLogs.map((log) => [
                formatDateTime(log.createdAt),
                log.user?.name ?? log.user?.email ?? "System",
                log.action,
                log.entityType,
                log.message ?? "-",
                summarizeMetadata(log.metadata)
              ])}
              emptyMessage="No API activity logs yet."
            />
          </div>
        )}
      </div>
    </div>
  );
}
