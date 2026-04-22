import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addDays, formatDateShort } from "@/lib/time";
import { formatCurrency, formatNumber } from "@/lib/format";
import { fetchGa4EcommerceReport, fetchGa4ProjectReports } from "@/lib/ga4";
import { getOrRefreshReport } from "@/lib/report-cache";
import ReportsFilters from "@/components/ReportsFilters";
import TrendChart from "@/components/TrendChart";
import ReportsDataTable from "@/components/ReportsDataTable";

export default async function ReportsPage({
  searchParams
}: {
  searchParams?: { projectId?: string; report?: string; range?: string; start?: string; end?: string; refresh?: string };
}) {
  const session = await getServerSession(authOptions);
  const user = session?.user;

  if (!user) {
    return null;
  }

  const projects = await prisma.project.findMany({
    where: user.role === "ADMIN" ? {} : { projectUsers: { some: { userId: user.id } } },
    orderBy: { createdAt: "desc" }
  });

  const selectedId = searchParams?.projectId ?? projects[0]?.id;
  const reportKey = searchParams?.report ?? "snapshot";
  const rangeKey = searchParams?.range ?? "last30";
  const refresh = searchParams?.refresh === "1";
  if (!selectedId) {
    return (
      <div className="alert">No projects available. Import GA4 properties first.</div>
    );
  }

  const project = await prisma.project.findUnique({
    where: { id: selectedId },
    include: { dataSources: true }
  });

  if (!project) {
    return (
      <div className="alert">Project not found.</div>
    );
  }

  if (user.role !== "ADMIN") {
    const access = await prisma.projectUser.findUnique({
      where: { projectId_userId: { projectId: project.id, userId: user.id } }
    });
    if (!access) {
      return (
        <div className="alert">You do not have access to this project.</div>
      );
    }
  }

  const ga4Source = project.dataSources.find((item) => item.type === "GA4");
  const ga4Integration = await prisma.integrationSetting.findUnique({ where: { type: "GA4" } });
  const reportEnd = searchParams?.end ? new Date(searchParams.end) : new Date();
  let reportStart = searchParams?.start ? new Date(searchParams.start) : addDays(reportEnd, -29);
  if (rangeKey === "last7") {
    reportStart = addDays(reportEnd, -6);
  } else if (rangeKey === "last90") {
    reportStart = addDays(reportEnd, -89);
  } else if (rangeKey === "month") {
    reportStart = new Date(reportEnd.getFullYear(), reportEnd.getMonth(), 1);
  }

  let reports: Awaited<ReturnType<typeof fetchGa4ProjectReports>> | null = null;
  let reportsError: string | null = null;
  let ecommerceRows: { label: string; values: number[] }[] = [];
  let ecommerceMode: "items" | "events" = "items";
  let ecommerceError: string | null = null;

  function formatRate(value: number) {
    return `${(value * 100).toFixed(1)}%`;
  }

  function formatDuration(seconds: number) {
    const total = Math.round(seconds);
    const minutes = Math.floor(total / 60);
    const remaining = total % 60;
    return `${minutes}m ${String(remaining).padStart(2, "0")}s`;
  }

  if (ga4Integration?.refreshToken && ga4Source?.externalId) {
    try {
      reports = await getOrRefreshReport({
        projectId: project.id,
        reportKey: "snapshot",
        rangeStart: reportStart,
        rangeEnd: reportEnd,
        fetcher: () =>
          fetchGa4ProjectReports({
            propertyId: ga4Source.externalId!,
            refreshToken: ga4Integration.refreshToken!,
            startDate: formatDateShort(reportStart),
            endDate: formatDateShort(reportEnd)
          }),
        force: refresh
      });
    } catch (error) {
      reports = null;
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("GA4 reports fetch failed:", message);
      reportsError = `Failed to fetch GA4 reports. ${message}`;
    }

    if (reportKey === "monetization" || reportKey === "snapshot") {
      try {
        const ecommerceData = await getOrRefreshReport({
          projectId: project.id,
          reportKey: "detail:ecommerce-purchases:v2",
          rangeStart: reportStart,
          rangeEnd: reportEnd,
          fetcher: () =>
            fetchGa4EcommerceReport({
              propertyId: ga4Source.externalId!,
              refreshToken: ga4Integration.refreshToken!,
              startDate: formatDateShort(reportStart),
              endDate: formatDateShort(reportEnd),
              limit: 100
            }),
          force: refresh
        });
        ecommerceRows = ecommerceData.rows ?? [];
        ecommerceMode = ecommerceData.mode ?? "items";
        ecommerceError = ecommerceData.warning ?? null;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("GA4 ecommerce fetch failed:", message);
        ecommerceError = `E-commerce data not available. ${message}`;
      }
    }
  }

  const menu = [
    { key: "snapshot", label: "Reports snapshot" },
    { key: "realtime-overview", label: "Realtime overview" },
    { key: "realtime-pages", label: "Realtime pages" },
    { key: "acquisition", label: "Acquisition" },
    { key: "engagement", label: "Engagement" },
    { key: "monetization", label: "E-commerce purchases" },
    { key: "retention", label: "Retention" },
    { key: "tech", label: "Tech" }
  ];
  const filterParams = new URLSearchParams({
    projectId: project.id,
    range: rangeKey,
    start: formatDateShort(reportStart),
    end: formatDateShort(reportEnd)
  });

  return (
    <div className="space-y-8">
      <ReportsFilters
        projects={projects.map((item) => ({ id: item.id, name: item.name }))}
        selectedProjectId={project.id}
        report={reportKey}
        range={rangeKey as any}
        start={formatDateShort(reportStart)}
        end={formatDateShort(reportEnd)}
        refresh={searchParams?.refresh}
        basePath="/reports"
      />

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <div className="card sticky top-0 z-10 h-fit space-y-2 self-start max-h-[calc(100vh-2rem)] overflow-y-auto">
          {menu.map((item) => {
            const active = item.key === reportKey;
            const params = new URLSearchParams(filterParams);
            params.set("report", item.key);
            return (
              <a
                key={item.key}
                href={`/reports?${params.toString()}`}
                className={`block rounded-xl px-3 py-2 text-sm ${
                  active ? "bg-slate/10 text-slate" : "text-slate/60 hover:bg-slate/5"
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </div>

        <div>
          {!reports ? (
            <div className="alert">
              {reportsError ?? "Connect GA4 to view reports."}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="section-header">
                <div>
                  <h2 className="text-lg font-semibold">
                    {menu.find((item) => item.key === reportKey)?.label ?? "Reports"}
                  </h2>
                  <p className="text-sm text-slate/60">
                    {formatDateShort(reportStart)} - {formatDateShort(reportEnd)}
                  </p>
                </div>
                <a className="btn-outline" href={`/api/projects/${project.id}/reports/export`}>
                  Export CSV
                </a>
              </div>

              {(reportKey === "snapshot" || reportKey === "acquisition") && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="label">User acquisition</div>
                      <a className="text-xs text-ocean" href={`/reports/acquisition-users?${filterParams.toString()}`}>
                        View all
                      </a>
                    </div>
                    <ReportsDataTable
                      title="User acquisition"
                      dimensionLabel="Channel"
                      columns={[{ label: "New users" }]}
                      rows={reports.acquisitionUsers.map((row) => ({ label: row.label, values: [row.value] }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="label">Traffic acquisition</div>
                      <a className="text-xs text-ocean" href={`/reports/acquisition-sessions?${filterParams.toString()}`}>
                        View all
                      </a>
                    </div>
                    <ReportsDataTable
                      title="Traffic acquisition"
                      dimensionLabel="Channel"
                      columns={[{ label: "Sessions" }]}
                      rows={reports.acquisitionSessions.map((row) => ({ label: row.label, values: [row.value] }))}
                    />
                  </div>
                </div>
              )}

              {(reportKey === "snapshot" || reportKey === "engagement") && (
                <>
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
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="label">Top events</div>
                        <a className="text-xs text-ocean" href={`/reports/top-events?${filterParams.toString()}`}>
                          View all
                        </a>
                      </div>
                      <ReportsDataTable
                        title="Top events"
                        dimensionLabel="Event"
                        columns={[{ label: "Event count" }]}
                        rows={reports.topEvents.map((row) => ({ label: row.label, values: [row.value] }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="label">Top pages</div>
                        <a className="text-xs text-ocean" href={`/reports/top-pages?${filterParams.toString()}`}>
                          View all
                        </a>
                      </div>
                      <ReportsDataTable
                        title="Top pages"
                        dimensionLabel="Page"
                        columns={[{ label: "Views" }]}
                        rows={reports.topPages.map((row) => ({ label: row.label, values: [row.value] }))}
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="label">Least visited pages</div>
                        <a className="text-xs text-ocean" href={`/reports/least-pages?${filterParams.toString()}`}>
                          View all
                        </a>
                      </div>
                      <ReportsDataTable
                        title="Least visited pages"
                        dimensionLabel="Page"
                        columns={[{ label: "Views" }]}
                        rows={reports.leastPages.map((row) => ({ label: row.label, values: [row.value] }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="label">Search terms</div>
                        <a className="text-xs text-ocean" href={`/reports/search-terms?${filterParams.toString()}`}>
                          View all
                        </a>
                      </div>
                      <ReportsDataTable
                        title="Search terms"
                        dimensionLabel="Search term"
                        columns={[{ label: "Sessions" }]}
                        rows={reports.searchTerms.map((row) => ({ label: row.label, values: [row.value] }))}
                      />
                    </div>
                  </div>
                </>
              )}

              {(reportKey === "snapshot" || reportKey === "monetization") && (
                <div className="space-y-3">
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
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="label">E-commerce purchases</div>
                      <a
                        className="text-xs text-ocean"
                        href={`/reports/ecommerce-purchases?${filterParams.toString()}`}
                      >
                        View all
                      </a>
                    </div>
                    {ecommerceError ? (
                      <div className="alert">{ecommerceError}</div>
                    ) : null}
                    {ecommerceRows.length === 0 ? (
                      <div className="alert">
                        Item-level ecommerce metrics are not available for this property or date range.
                      </div>
                    ) : (
                      <ReportsDataTable
                        title="E-commerce purchases"
                        dimensionLabel={ecommerceMode === "items" ? "Item name" : "Event"}
                        columns={
                          ecommerceMode === "items"
                            ? [
                                { label: "Items viewed" },
                                { label: "Items added to cart" },
                                { label: "Items purchased" },
                                { label: "Item revenue", formatType: "currency" }
                              ]
                            : [{ label: "Event count" }]
                        }
                        rows={ecommerceRows.map((row) => ({ label: row.label, values: row.values }))}
                        currency={project.currency}
                      />
                    )}
                  </div>
                </div>
              )}

              {(reportKey === "snapshot" || reportKey === "retention") && (
                <div className="grid gap-4 md:grid-cols-2">
                  <TrendChart points={reports.retention.newUsers} label="New users (30 days)" />
                  <TrendChart points={reports.retention.returningUsers} label="Returning users (30 days)" />
                </div>
              )}

              {(reportKey === "snapshot" || reportKey === "realtime-overview") && (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <div className="card">
                    <div className="label">Active users</div>
                    <div className="kpi">{formatNumber(reports.summary.activeUsers)}</div>
                  </div>
                  <div className="card">
                    <div className="label">New users</div>
                    <div className="kpi">{formatNumber(reports.summary.newUsers)}</div>
                  </div>
                  <div className="card">
                    <div className="label">Sessions</div>
                    <div className="kpi">{formatNumber(reports.summary.sessions)}</div>
                  </div>
                </div>
              )}

              {reportKey === "realtime-pages" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="label">Top pages</div>
                    <a className="text-xs text-ocean" href={`/reports/top-pages?${filterParams.toString()}`}>
                      View all
                    </a>
                  </div>
                  <ReportsDataTable
                    title="Top pages"
                    dimensionLabel="Page"
                    columns={[{ label: "Views" }]}
                    rows={reports.topPages.map((row) => ({ label: row.label, values: [row.value] }))}
                  />
                </div>
              )}

              {reportKey === "tech" && (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="label">Platform</div>
                        <a className="text-xs text-ocean" href={`/reports/platform?${filterParams.toString()}`}>
                          View all
                        </a>
                      </div>
                      <ReportsDataTable
                        title="Platform"
                        dimensionLabel="Platform"
                        columns={[{ label: "Active users" }]}
                        rows={reports.tech.platform.map((row) => ({ label: row.label, values: [row.value] }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="label">Operating system</div>
                        <a className="text-xs text-ocean" href={`/reports/operating-system?${filterParams.toString()}`}>
                          View all
                        </a>
                      </div>
                      <ReportsDataTable
                        title="Operating system"
                        dimensionLabel="Operating system"
                        columns={[{ label: "Active users" }]}
                        rows={reports.tech.operatingSystem.map((row) => ({ label: row.label, values: [row.value] }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="label">Browser</div>
                        <a className="text-xs text-ocean" href={`/reports/browser?${filterParams.toString()}`}>
                          View all
                        </a>
                      </div>
                      <ReportsDataTable
                        title="Browser"
                        dimensionLabel="Browser"
                        columns={[{ label: "Active users" }]}
                        rows={reports.tech.browser.map((row) => ({ label: row.label, values: [row.value] }))}
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="label">Device category</div>
                        <a className="text-xs text-ocean" href={`/reports/device-category?${filterParams.toString()}`}>
                          View all
                        </a>
                      </div>
                      <ReportsDataTable
                        title="Device category"
                        dimensionLabel="Device category"
                        columns={[{ label: "Active users" }]}
                        rows={reports.tech.deviceCategory.map((row) => ({ label: row.label, values: [row.value] }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="label">Platform / device</div>
                        <a className="text-xs text-ocean" href={`/reports/platform-device?${filterParams.toString()}`}>
                          View all
                        </a>
                      </div>
                      <ReportsDataTable
                        title="Platform / device"
                        dimensionLabel="Platform / device"
                        columns={[{ label: "Active users" }]}
                        rows={reports.tech.platformDevice.map((row) => ({ label: row.label, values: [row.value] }))}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
