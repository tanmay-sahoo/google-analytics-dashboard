import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateShort } from "@/lib/time";
import ProjectDetailClient from "@/components/ProjectDetailClient";
import Tabs from "@/components/Tabs";

type ProjectDetailTab = "storage" | "rows" | "ingestion" | "activity";
const PROJECT_DETAIL_TABS: ProjectDetailTab[] = ["storage", "rows", "ingestion", "activity"];

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
  searchParams?: Promise<{ tab?: string }>;
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

  const [ga4Metrics, adsMetrics] = await Promise.all([
    prisma.metricDaily.groupBy({
      by: ["source"],
      where: { projectId: project.id },
      _count: { _all: true },
      _max: { date: true, createdAt: true }
    }),
    prisma.metricDaily.findMany({
      where: { projectId: project.id },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 40
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
      where: { projectId: project.id },
      orderBy: { startedAt: "desc" },
      take: 40,
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
        entityType: { in: ["METRICS", "DATASOURCE"] }
      },
      orderBy: { createdAt: "desc" },
      take: 60,
      include: { user: { select: { id: true, name: true, email: true } } }
    })
  ]);

  const requestedTab = resolvedSearchParams?.tab as ProjectDetailTab | undefined;
  const activeTab: ProjectDetailTab =
    requestedTab && PROJECT_DETAIL_TABS.includes(requestedTab) ? requestedTab : "storage";
  const tabHref = (key: string) => `/projects/${project.id}?tab=${key}`;
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
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Total rows</th>
                    <th>Last metric date</th>
                    <th>Last fetched at</th>
                  </tr>
                </thead>
                <tbody>
                  {ga4Metrics.length ? (
                    ga4Metrics.map((item) => (
                      <tr key={item.source} className="border-t border-slate-100">
                        <td>{item.source}</td>
                        <td>{item._count._all}</td>
                        <td>{item._max.date ? formatDateShort(item._max.date) : "-"}</td>
                        <td>{formatDateTime(item._max.createdAt)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr className="border-t border-slate-100">
                      <td colSpan={4}>No metric rows saved yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "rows" && (
          <div className="card space-y-4">
            <div>
              <div className="label">Latest fetched data rows</div>
              <p className="text-sm text-slate/60">Recent per-day metric rows persisted for this project.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Metric date</th>
                    <th>Fetched at</th>
                    <th>Fetched fields</th>
                  </tr>
                </thead>
                <tbody>
                  {adsMetrics.length ? (
                    adsMetrics.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100">
                        <td>{row.source}</td>
                        <td>{formatDateShort(row.date)}</td>
                        <td>{formatDateTime(row.createdAt)}</td>
                        <td>{summarizeJson(row.metrics, 6)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr className="border-t border-slate-100">
                      <td colSpan={4}>No fetched metric rows yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "ingestion" && (
          <div className="card space-y-4">
            <div>
              <div className="label">Ingestion fetch logs</div>
              <p className="text-sm text-slate/60">Scheduled/cron ingestion history for this project.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Run started</th>
                    <th>Run status</th>
                    <th>Project fetch started</th>
                    <th>Project fetch finished</th>
                    <th>GA4 rows</th>
                    <th>Ads rows</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {ingestionLogs.length ? (
                    ingestionLogs.map((log) => (
                      <tr key={log.id} className="border-t border-slate-100">
                        <td>{formatDateTime(log.run.startedAt)}</td>
                        <td>{log.run.status}</td>
                        <td>{formatDateTime(log.startedAt)}</td>
                        <td>{formatDateTime(log.finishedAt)}</td>
                        <td>{log.ga4Inserted}</td>
                        <td>{log.adsInserted}</td>
                        <td>{log.error ?? log.run.error ?? "-"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr className="border-t border-slate-100">
                      <td colSpan={7}>No ingestion logs yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "activity" && (
          <div className="card space-y-4">
            <div>
              <div className="label">API activity logs</div>
              <p className="text-sm text-slate/60">Manual/source API actions with fetched metadata snapshots.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Message</th>
                    <th>Metadata</th>
                  </tr>
                </thead>
                <tbody>
                  {activityLogs.length ? (
                    activityLogs.map((log) => (
                      <tr key={log.id} className="border-t border-slate-100">
                        <td>{formatDateTime(log.createdAt)}</td>
                        <td>{log.user?.name ?? log.user?.email ?? "System"}</td>
                        <td>{log.action}</td>
                        <td>{log.entityType}</td>
                        <td>{log.message ?? "-"}</td>
                        <td>{summarizeMetadata(log.metadata)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr className="border-t border-slate-100">
                      <td colSpan={6}>No API activity logs yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
