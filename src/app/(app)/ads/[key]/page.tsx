import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addDays, formatDateShort } from "@/lib/time";
import { getOrRefreshReport } from "@/lib/report-cache";
import { fetchAdsIntelligence, type AdsBreakdownRow, type AdsIntelligenceData } from "@/lib/ads-intelligence";
import AdsIntelligenceFilters from "@/components/AdsIntelligenceFilters";
import ReportsDataTable from "@/components/ReportsDataTable";

type RangeKey = "last7" | "last30" | "last90" | "month" | "custom";
type FormatType = "number" | "currency";

function normalizeAdsData(data: AdsIntelligenceData | null): AdsIntelligenceData | null {
  if (!data) return null;
  const raw = data as AdsIntelligenceData & { locations?: AdsIntelligenceData["locationCountries"] };
  return {
    ...raw,
    trend: Array.isArray(raw.trend) ? raw.trend : [],
    products: Array.isArray(raw.products) ? raw.products : [],
    campaigns: Array.isArray(raw.campaigns) ? raw.campaigns : [],
    locationCountries: Array.isArray(raw.locationCountries)
      ? raw.locationCountries
      : Array.isArray(raw.locations)
        ? raw.locations
        : [],
    locationCities: Array.isArray(raw.locationCities) ? raw.locationCities : [],
    keywords: Array.isArray(raw.keywords) ? raw.keywords : [],
    negativeKeywordCandidates: Array.isArray(raw.negativeKeywordCandidates)
      ? raw.negativeKeywordCandidates
      : [],
    warnings: Array.isArray(raw.warnings) ? raw.warnings : []
  };
}

type DetailConfig = {
  title: string;
  dimensionLabel: string;
  columns: Array<{ label: string; formatType?: FormatType }>;
  getRows: (data: AdsIntelligenceData) => Array<{ label: string; values: number[] }>;
};

const adsDetailMap: Record<string, DetailConfig> = {
  campaigns: {
    title: "Campaign Details",
    dimensionLabel: "Campaign",
    columns: [
      { label: "Spend", formatType: "currency" },
      { label: "Revenue", formatType: "currency" },
      { label: "Clicks" },
      { label: "Impressions" },
      { label: "Conversions" },
      { label: "CPC", formatType: "currency" },
      { label: "CPA", formatType: "currency" },
      { label: "ROAS" }
    ],
    getRows: (data) => toRows(data.campaigns, (row) => [
      row.spend,
      row.conversionValue,
      row.clicks,
      row.impressions,
      row.conversions,
      row.cpc,
      row.cpa,
      row.roas
    ])
  },
  products: {
    title: "Product Spend vs Revenue",
    dimensionLabel: "Product",
    columns: [
      { label: "Spend", formatType: "currency" },
      { label: "Revenue", formatType: "currency" },
      { label: "Clicks" },
      { label: "Impressions" },
      { label: "Conversions" },
      { label: "ROAS" }
    ],
    getRows: (data) =>
      toRows(data.products, (row) => [
        row.spend,
        row.conversionValue,
        row.clicks,
        row.impressions,
        row.conversions,
        row.roas
      ])
  },
  "locations-country": {
    title: "Country Revenue & Spend",
    dimensionLabel: "Country",
    columns: [
      { label: "Revenue", formatType: "currency" },
      { label: "Spend", formatType: "currency" },
      { label: "Conversions" },
      { label: "ROAS" }
    ],
    getRows: (data) =>
      toRows(data.locationCountries, (row) => [row.conversionValue, row.spend, row.conversions, row.roas])
  },
  "locations-city": {
    title: "City Revenue & Spend",
    dimensionLabel: "City",
    columns: [
      { label: "Revenue", formatType: "currency" },
      { label: "Spend", formatType: "currency" },
      { label: "Conversions" },
      { label: "ROAS" }
    ],
    getRows: (data) =>
      toRows(data.locationCities, (row) => [row.conversionValue, row.spend, row.conversions, row.roas])
  },
  keywords: {
    title: "Top Keywords",
    dimensionLabel: "Keyword",
    columns: [
      { label: "Spend", formatType: "currency" },
      { label: "Revenue", formatType: "currency" },
      { label: "Clicks" },
      { label: "Conversions" },
      { label: "CPA", formatType: "currency" },
      { label: "ROAS" }
    ],
    getRows: (data) =>
      toRows(data.keywords, (row) => [
        row.spend,
        row.conversionValue,
        row.clicks,
        row.conversions,
        row.cpa,
        row.roas
      ])
  },
  "negative-keywords": {
    title: "Negative Keyword Candidates",
    dimensionLabel: "Search term",
    columns: [
      { label: "Spend", formatType: "currency" },
      { label: "Clicks" },
      { label: "Impressions" },
      { label: "Conversions" },
      { label: "Revenue", formatType: "currency" }
    ],
    getRows: (data) =>
      toRows(data.negativeKeywordCandidates, (row) => [
        row.spend,
        row.clicks,
        row.impressions,
        row.conversions,
        row.conversionValue
      ])
  }
};

function toRows(rows: AdsBreakdownRow[], selector: (row: AdsBreakdownRow) => number[]) {
  return rows.map((row) => ({
    label: row.label,
    values: selector(row)
  }));
}

function resolveRange(range: RangeKey, startParam?: string, endParam?: string) {
  const end = endParam ? new Date(endParam) : new Date();
  let start = startParam ? new Date(startParam) : addDays(end, -29);
  if (range === "last7") start = addDays(end, -6);
  else if (range === "last30") start = addDays(end, -29);
  else if (range === "last90") start = addDays(end, -89);
  else if (range === "month") start = new Date(end.getFullYear(), end.getMonth(), 1);

  return { start, end };
}

export default async function AdsDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ key: string }>;
  searchParams?: Promise<{
    projectId?: string;
    range?: RangeKey;
    start?: string;
    end?: string;
    refresh?: string;
  }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const session = await getServerSession(authOptions);
  const user = session?.user;
  if (!user) return null;

  const detail = adsDetailMap[resolvedParams.key];
  if (!detail) {
    return <div className="alert">Report not found.</div>;
  }

  const projects = await prisma.project.findMany({
    where: user.role === "ADMIN" ? {} : { projectUsers: { some: { userId: user.id } } },
    orderBy: { createdAt: "desc" },
    include: { dataSources: true }
  });

  if (!projects.length) {
    return <div className="alert">No projects available yet.</div>;
  }

  const selectedProjectId = resolvedSearchParams?.projectId ?? projects[0].id;
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? projects[0];

  if (user.role !== "ADMIN") {
    const access = await prisma.projectUser.findUnique({
      where: { projectId_userId: { projectId: selectedProject.id, userId: user.id } }
    });
    if (!access) {
      return <div className="alert">You do not have access to this project.</div>;
    }
  }

  const rangeKey = (resolvedSearchParams?.range ?? "last30") as RangeKey;
  const { start, end } = resolveRange(rangeKey, resolvedSearchParams?.start, resolvedSearchParams?.end);
  const forceRefresh = resolvedSearchParams?.refresh === "1";

  const adsSource = selectedProject.dataSources.find((item) => item.type === "ADS")?.externalId;
  const adsIntegration = await prisma.integrationSetting.findUnique({
    where: { type: "ADS" }
  });

  let intelligence: AdsIntelligenceData | null = null;
  let errorMessage: string | null = null;

  if (!adsSource || !adsIntegration?.refreshToken) {
    errorMessage = "Google Ads is not connected for this project.";
  } else {
    try {
      intelligence = await getOrRefreshReport({
        projectId: selectedProject.id,
        reportKey: "ads-intelligence:v3",
        rangeStart: start,
        rangeEnd: end,
        fetcher: () =>
          fetchAdsIntelligence({
            customerId: adsSource,
            refreshToken: adsIntegration.refreshToken!,
            startDate: formatDateShort(start),
            endDate: formatDateShort(end)
          }),
        force: forceRefresh
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      errorMessage = `Failed to fetch Ads intelligence. ${message}`;
    }
  }

  intelligence = normalizeAdsData(intelligence);
  const rows = intelligence ? detail.getRows(intelligence) : [];

  return (
    <div className="space-y-6">
      <AdsIntelligenceFilters
        projects={projects.map((project) => ({ id: project.id, name: project.name }))}
        selectedProjectId={selectedProject.id}
        range={rangeKey}
        start={formatDateShort(start)}
        end={formatDateShort(end)}
        basePath={`/ads/${resolvedParams.key}`}
      />

      <div className="section-header">
        <div>
          <h2 className="text-lg font-semibold">{detail.title}</h2>
          <p className="text-sm text-slate/60">
            {formatDateShort(start)} - {formatDateShort(end)}
          </p>
        </div>
      </div>

      {errorMessage ? <div className="alert">{errorMessage}</div> : null}

      {intelligence?.warnings.length ? (
        <div className="space-y-2">
          {intelligence.warnings.map((warning) => (
            <div key={warning} className="alert">
              {warning}
            </div>
          ))}
        </div>
      ) : null}

      {!errorMessage && !rows.length ? (
        <div className="alert">No data found for this report and date range.</div>
      ) : null}

      {rows.length ? (
        <ReportsDataTable
          title={detail.title}
          dimensionLabel={detail.dimensionLabel}
          currency={selectedProject.currency}
          columns={detail.columns}
          rows={rows}
        />
      ) : null}
    </div>
  );
}
