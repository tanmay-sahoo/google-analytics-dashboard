import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatNumber } from "@/lib/format";
import { addDays, formatDateShort } from "@/lib/time";
import TrendChart from "@/components/TrendChart";
import Table from "@/components/Table";
import ProjectDetailClient from "@/components/ProjectDetailClient";
import { fetchGa4Breakdowns, fetchGa4ProjectReports } from "@/lib/ga4";

export default async function ProjectDetailPage({
  params
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  const user = session?.user;

  if (!user) {
    return null;
  }

  const project = await prisma.project.findUnique({
    where: { id: params.id },
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
    prisma.metricDaily.findMany({
      where: { projectId: project.id, source: "GA4" },
      orderBy: { date: "asc" },
      take: 30
    }),
    prisma.metricDaily.findMany({
      where: { projectId: project.id, source: "ADS" },
      orderBy: { date: "asc" },
      take: 30
    })
  ]);

  const ga4Sessions = ga4Metrics.map((item) => Number((item.metrics as any).sessions ?? 0));
  const adsSpend = adsMetrics.map((item) => Number((item.metrics as any).spend ?? 0));

  const ga4Source = project.dataSources.find((item) => item.type === "GA4");
  const adsSource = project.dataSources.find((item) => item.type === "ADS");
  const ga4Id = ga4Source?.externalId;
  const adsId = adsSource?.externalId;

  const ga4Integration = await prisma.integrationSetting.findUnique({ where: { type: "GA4" } });
  let campaigns: Array<[string, string, string]> = [];
  let sources: Array<[string, string, string]> = [];
  let devices: Array<[string, string, string]> = [];
  let reports: Awaited<ReturnType<typeof fetchGa4ProjectReports>> | null = null;
  let reportsError: string | null = null;
  const reportEnd = new Date();
  const reportStart = addDays(reportEnd, -29);

  function formatRate(value: number) {
    return `${(value * 100).toFixed(1)}%`;
  }

  function formatDuration(seconds: number) {
    const total = Math.round(seconds);
    const minutes = Math.floor(total / 60);
    const remaining = total % 60;
    return `${minutes}m ${String(remaining).padStart(2, "0")}s`;
  }

  if (ga4Integration?.refreshToken && ga4Id) {
    try {
      const breakdowns = await fetchGa4Breakdowns({
        propertyId: ga4Id,
        refreshToken: ga4Integration.refreshToken
      });
      campaigns = breakdowns.campaigns.map((row) => [
        row.label,
        formatNumber(row.sessions),
        formatCurrency(row.revenue, project.currency)
      ]);
      sources = breakdowns.sources.map((row) => [
        row.label,
        formatNumber(row.sessions),
        `${row.conversions.toFixed(0)}`
      ]);
      devices = breakdowns.devices.map((row) => [
        row.label,
        formatNumber(row.users),
        formatNumber(row.sessions)
      ]);
      reports = await fetchGa4ProjectReports({
        propertyId: ga4Id,
        refreshToken: ga4Integration.refreshToken,
        startDate: formatDateShort(reportStart),
        endDate: formatDateShort(reportEnd)
      });
    } catch (error) {
      campaigns = [];
      sources = [];
      devices = [];
      reports = null;
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("GA4 reports fetch failed:", message);
      reportsError = `Failed to fetch GA4 reports. ${message}`;
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">{project.name}</h1>
        <p className="text-sm text-slate/60">
          {project.timezone} - {project.currency} - Last synced {ga4Metrics.at(-1)?.date ? formatDateShort(ga4Metrics.at(-1)!.date) : "--"}
        </p>
      </div>

      <ProjectDetailClient
        projectId={project.id}
        ga4Id={ga4Id}
        adsId={adsId}
        projectName={project.name}
        role={user.role}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <TrendChart points={ga4Sessions} label="Sessions (30 days)" />
        <TrendChart points={adsSpend} label="Spend (30 days)" />
      </div>

      {reports ? (
        <div className="space-y-6">
          <div className="section-header">
            <div>
              <h2 className="text-lg font-semibold">Reports snapshot</h2>
              <p className="text-sm text-slate/60">
                {formatDateShort(reportStart)} - {formatDateShort(reportEnd)}
              </p>
            </div>
            <a className="btn-outline" href={`/api/projects/${project.id}/reports/export`}>
              Export CSV
            </a>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="card">
              <div className="label">Active users</div>
              <div className="kpi">{formatNumber(reports.summary.activeUsers)}</div>
            </div>
            <div className="card">
              <div className="label">New users</div>
              <div className="kpi">{formatNumber(reports.summary.newUsers)}</div>
            </div>
            <div className="card">
              <div className="label">Returning users</div>
              <div className="kpi">{formatNumber(reports.summary.returningUsers)}</div>
            </div>
            <div className="card">
              <div className="label">Sessions</div>
              <div className="kpi">{formatNumber(reports.summary.sessions)}</div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Table
              headers={["User acquisition", "New users"]}
              rows={
                reports.acquisitionUsers.length
                  ? reports.acquisitionUsers.map((row) => [row.label, formatNumber(row.value)])
                  : [["No data", "-"]]
              }
            />
            <Table
              headers={["Traffic acquisition", "Sessions"]}
              rows={
                reports.acquisitionSessions.length
                  ? reports.acquisitionSessions.map((row) => [row.label, formatNumber(row.value)])
                  : [["No data", "-"]]
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="card">
              <div className="label">Engagement rate</div>
              <div className="kpi">{formatRate(reports.engagement.engagementRate)}</div>
            </div>
            <div className="card">
              <div className="label">Bounce rate</div>
              <div className="kpi">{formatRate(reports.engagement.bounceRate)}</div>
            </div>
            <div className="card">
              <div className="label">Avg session duration</div>
              <div className="kpi">{formatDuration(reports.engagement.averageSessionDuration)}</div>
            </div>
            <div className="card">
              <div className="label">Sessions per user</div>
              <div className="kpi">{reports.engagement.sessionsPerUser.toFixed(2)}</div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Table
              headers={["Top events", "Event count"]}
              rows={
                reports.topEvents.length
                  ? reports.topEvents.map((row) => [row.label, formatNumber(row.value)])
                  : [["No data", "-"]]
              }
            />
            <Table
              headers={["Top pages", "Views"]}
              rows={
                reports.topPages.length
                  ? reports.topPages.map((row) => [row.label, formatNumber(row.value)])
                  : [["No data", "-"]]
              }
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Table
              headers={["Least visited pages", "Views"]}
              rows={
                reports.leastPages.length
                  ? reports.leastPages.map((row) => [row.label, formatNumber(row.value)])
                  : [["No data", "-"]]
              }
            />
            <Table
              headers={["Search terms", "Sessions"]}
              rows={
                reports.searchTerms.length
                  ? reports.searchTerms.map((row) => [row.label, formatNumber(row.value)])
                  : [["No data", "-"]]
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="card">
              <div className="label">Total revenue</div>
              <div className="kpi">{formatCurrency(reports.summary.totalRevenue, project.currency)}</div>
            </div>
            <div className="card">
              <div className="label">Conversions</div>
              <div className="kpi">{formatNumber(reports.summary.conversions)}</div>
            </div>
            <div className="card">
              <div className="label">Page views</div>
              <div className="kpi">{formatNumber(reports.engagement.pageViews)}</div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <TrendChart points={reports.retention.newUsers} label="New users (30 days)" />
            <TrendChart points={reports.retention.returningUsers} label="Returning users (30 days)" />
          </div>
        </div>
      ) : (
        <div className="alert">
          {reportsError ?? "Connect GA4 and sync metrics to unlock project reports."}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Table
            headers={["Top campaigns", "Clicks", "Revenue"]}
            rows={campaigns.length ? campaigns.map((row) => row.map((cell) => String(cell))) : [["No data", "-", "-"]]}
          />
        </div>
        <Table
          headers={["Top sources / medium", "Sessions", "Conv. Rate"]}
          rows={sources.length ? sources.map((row) => row.map((cell) => String(cell))) : [["No data", "-", "-"]]}
        />
      </div>

      <Table
        headers={["Device", "Share", "Users"]}
        rows={devices.length ? devices.map((row) => row.map((cell) => String(cell))) : [["No data", "-", "-"]]}
      />
    </div>
  );
}
