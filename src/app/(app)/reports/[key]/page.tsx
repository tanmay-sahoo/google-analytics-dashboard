import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addDays, formatDateShort } from "@/lib/time";
import { fetchGa4EcommerceReport, fetchGa4ReportDetail } from "@/lib/ga4";
import { getOrRefreshReport } from "@/lib/report-cache";
import { reportDetailMap } from "@/lib/report-config";
import ReportsFilters from "@/components/ReportsFilters";
import ReportsDataTable from "@/components/ReportsDataTable";

const reportMap = reportDetailMap;

export default async function ReportsDetailPage({
  params,
  searchParams
}: {
  params: { key: string };
  searchParams?: { projectId?: string; range?: string; start?: string; end?: string; refresh?: string };
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
  if (!selectedId) {
    return <div className="alert">No projects available. Import GA4 properties first.</div>;
  }

  const project = await prisma.project.findUnique({
    where: { id: selectedId },
    include: { dataSources: true }
  });

  if (!project) {
    return <div className="alert">Project not found.</div>;
  }

  if (user.role !== "ADMIN") {
    const access = await prisma.projectUser.findUnique({
      where: { projectId_userId: { projectId: project.id, userId: user.id } }
    });
    if (!access) {
      return <div className="alert">You do not have access to this project.</div>;
    }
  }

  const reportKey = params.key;
  const report = reportMap[reportKey];

  const rangeKey = searchParams?.range ?? "last30";
  const refresh = searchParams?.refresh === "1";
  const reportEnd = searchParams?.end ? new Date(searchParams.end) : new Date();
  let reportStart = searchParams?.start ? new Date(searchParams.start) : addDays(reportEnd, -29);
  if (rangeKey === "last7") {
    reportStart = addDays(reportEnd, -6);
  } else if (rangeKey === "last90") {
    reportStart = addDays(reportEnd, -89);
  } else if (rangeKey === "month") {
    reportStart = new Date(reportEnd.getFullYear(), reportEnd.getMonth(), 1);
  }

  const ga4Source = project.dataSources.find((item) => item.type === "GA4");
  const ga4Integration = await prisma.integrationSetting.findUnique({ where: { type: "GA4" } });

  let rows: { label: string; value: number }[] = [];
  let ecommerceRows: { label: string; values: number[] }[] = [];
  let ecommerceError: string | null = null;
  let errorMessage: string | null = null;

  if (ga4Integration?.refreshToken && ga4Source?.externalId) {
    if (reportKey === "ecommerce-purchases") {
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
        ecommerceError = ecommerceRows.length
          ? null
          : "Item-level ecommerce metrics are not available for this property or date range.";
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("GA4 ecommerce fetch failed:", message);
        ecommerceError = `Failed to fetch GA4 report. ${message}`;
      }
    } else if (report) {
      try {
        rows = await getOrRefreshReport({
          projectId: project.id,
          reportKey: `detail:${reportKey}`,
          rangeStart: reportStart,
          rangeEnd: reportEnd,
          fetcher: () =>
            fetchGa4ReportDetail({
              propertyId: ga4Source.externalId!,
              refreshToken: ga4Integration.refreshToken!,
              dimension: report.dimension,
              metric: report.metric,
              order: report.order ?? "desc",
              startDate: formatDateShort(reportStart),
              endDate: formatDateShort(reportEnd),
              limit: 100
            }),
          force: refresh
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("GA4 detail fetch failed:", message);
        errorMessage = `Failed to fetch GA4 report. ${message}`;
      }
    } else {
      errorMessage = "Report not found.";
    }
  } else {
    errorMessage = "Connect GA4 to view reports.";
  }

  return (
    <div className="space-y-8">
      <ReportsFilters
        projects={projects.map((item) => ({ id: item.id, name: item.name }))}
        selectedProjectId={project.id}
        report="snapshot"
        range={rangeKey as any}
        start={formatDateShort(reportStart)}
        end={formatDateShort(reportEnd)}
        basePath={`/reports/${reportKey}`}
      />

      <div className="section-header">
        <div>
          <h2 className="text-lg font-semibold">
            {report?.title ?? "E-commerce purchases"}
          </h2>
          <p className="text-sm text-slate/60">
            {formatDateShort(reportStart)} - {formatDateShort(reportEnd)}
          </p>
        </div>
      </div>

      {errorMessage ? (
        <div className="alert">{errorMessage}</div>
      ) : reportKey === "ecommerce-purchases" ? (
        ecommerceError ? (
          <div className="alert">{ecommerceError}</div>
        ) : (
          <ReportsDataTable
            title="E-commerce purchases"
            dimensionLabel="Item name"
            columns={[
              { label: "Items viewed" },
              { label: "Items added to cart" },
              { label: "Items purchased" },
              { label: "Item revenue", formatType: "currency" }
            ]}
            rows={ecommerceRows.map((row) => ({ label: row.label, values: row.values }))}
            currency={project.currency}
          />
        )
      ) : (
        <ReportsDataTable
          title={report!.title}
          dimensionLabel={report!.title}
          columns={[{ label: report!.metric }]}
          rows={rows.map((row) => ({ label: row.label, values: [row.value] }))}
        />
      )}
    </div>
  );
}
