import { prisma } from "@/lib/prisma";
import { formatDateShort } from "@/lib/time";
import PaginatedTable from "@/components/PaginatedTable";

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

export async function StorageTab({ projectId }: { projectId: string }) {
  const ga4Metrics = await prisma.metricDaily.groupBy({
    by: ["source"],
    where: { projectId },
    _count: { _all: true },
    _max: { date: true, createdAt: true }
  });

  return (
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
  );
}

export async function RowsTab({
  projectId,
  rangeStart,
  rangeEnd
}: {
  projectId: string;
  rangeStart: Date;
  rangeEnd: Date;
}) {
  const adsMetrics = await prisma.metricDaily.findMany({
    where: { projectId, date: { gte: rangeStart, lte: rangeEnd } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 200
  });

  return (
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
  );
}

export async function IngestionTab({
  projectId,
  rangeStart,
  rangeEnd
}: {
  projectId: string;
  rangeStart: Date;
  rangeEnd: Date;
}) {
  const ingestionLogs = await prisma.ingestionProjectLog.findMany({
    where: { projectId, startedAt: { gte: rangeStart, lte: rangeEnd } },
    orderBy: { startedAt: "desc" },
    take: 200,
    include: {
      run: {
        select: { id: true, status: true, startedAt: true, finishedAt: true, error: true }
      }
    }
  });

  return (
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
  );
}

export async function ActivityTab({
  projectId,
  rangeStart,
  rangeEnd
}: {
  projectId: string;
  rangeStart: Date;
  rangeEnd: Date;
}) {
  const activityLogs = await prisma.activityLog.findMany({
    where: {
      entityId: projectId,
      entityType: { in: ["METRICS", "DATASOURCE", "PROJECT"] },
      createdAt: { gte: rangeStart, lte: rangeEnd }
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { id: true, name: true, email: true } } }
  });

  return (
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
  );
}
