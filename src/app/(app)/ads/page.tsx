import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addDays, formatDateShort } from "@/lib/time";
import { formatCurrency, formatNumber } from "@/lib/format";
import { getOrRefreshReport } from "@/lib/report-cache";
import { fetchAdsIntelligence, type AdsIntelligenceData } from "@/lib/ads-intelligence";
import AdsIntelligenceFilters from "@/components/AdsIntelligenceFilters";
import KPICard from "@/components/KPICard";
import DualTrendChart from "@/components/DualTrendChart";
import ReportsDataTable from "@/components/ReportsDataTable";
import Tabs from "@/components/Tabs";

type RangeKey = "last7" | "last30" | "last90" | "month" | "custom";
type AdsTabKey = "campaigns" | "products" | "locations" | "keywords";
const ADS_TAB_KEYS: AdsTabKey[] = ["campaigns", "products", "locations", "keywords"];

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

function resolveRange(range: RangeKey, startParam?: string, endParam?: string) {
  const end = endParam ? new Date(endParam) : new Date();
  let start = startParam ? new Date(startParam) : addDays(end, -29);
  if (range === "last7") start = addDays(end, -6);
  else if (range === "last30") start = addDays(end, -29);
  else if (range === "last90") start = addDays(end, -89);
  else if (range === "month") start = new Date(end.getFullYear(), end.getMonth(), 1);

  return { start, end };
}

export default async function AdsPage({
  searchParams
}: {
  searchParams?: Promise<{
    projectId?: string;
    range?: RangeKey;
    start?: string;
    end?: string;
    refresh?: string;
    tab?: AdsTabKey;
  }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const session = await getServerSession(authOptions);
  const user = session?.user;
  if (!user) return null;

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

  const currency = selectedProject.currency;
  const topLocation = intelligence?.locationCountries?.[0] ?? null;
  const filterParams = new URLSearchParams({
    projectId: selectedProject.id,
    range: rangeKey,
    start: formatDateShort(start),
    end: formatDateShort(end)
  }).toString();
  const detailHref = (key: string) => `/ads/${key}?${filterParams}`;

  const requestedTab = resolvedSearchParams?.tab;
  const activeTab: AdsTabKey =
    requestedTab && ADS_TAB_KEYS.includes(requestedTab) ? requestedTab : "campaigns";
  const tabHref = (tab: AdsTabKey) => {
    const params = new URLSearchParams(filterParams);
    params.set("tab", tab);
    return `/ads?${params.toString()}`;
  };
  const tabItems = intelligence
    ? [
        { key: "campaigns", label: "Campaigns", count: intelligence.campaigns.length },
        { key: "products", label: "Products", count: intelligence.products.length },
        {
          key: "locations",
          label: "Locations",
          count: intelligence.locationCountries.length + intelligence.locationCities.length
        },
        {
          key: "keywords",
          label: "Keywords",
          count: intelligence.keywords.length + intelligence.negativeKeywordCandidates.length
        }
      ]
    : [];

  return (
    <div className="space-y-6">
      <AdsIntelligenceFilters
        projects={projects.map((project) => ({ id: project.id, name: project.name }))}
        selectedProjectId={selectedProject.id}
        range={rangeKey}
        start={formatDateShort(start)}
        end={formatDateShort(end)}
        urlHadRange={Boolean(resolvedSearchParams?.range)}
      />

      {errorMessage ? <div className="alert">{errorMessage}</div> : null}

      {intelligence ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <KPICard
              label="Spend"
              value={formatCurrency(intelligence.summary.spend, currency)}
              trend={intelligence.trend.map((row) => row.spend)}
            />
            <KPICard
              label="Revenue"
              value={formatCurrency(intelligence.summary.conversionValue, currency)}
              trend={intelligence.trend.map((row) => row.conversionValue)}
            />
            <KPICard
              label="CTR"
              value={`${intelligence.summary.ctr.toFixed(2)}%`}
              trend={intelligence.trend.map((row) =>
                row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0
              )}
            />
            <KPICard
              label="CPC"
              value={formatCurrency(intelligence.summary.cpc, currency)}
              trend={intelligence.trend.map((row) => (row.clicks > 0 ? row.spend / row.clicks : 0))}
            />
            <KPICard
              label="CPM"
              value={formatCurrency(intelligence.summary.cpm, currency)}
              trend={intelligence.trend.map((row) =>
                row.impressions > 0 ? (row.spend * 1000) / row.impressions : 0
              )}
            />
            <KPICard
              label="CPA"
              value={formatCurrency(intelligence.summary.cpa, currency)}
              trend={intelligence.trend.map((row) =>
                row.conversions > 0 ? row.spend / row.conversions : 0
              )}
            />
            <KPICard label="CAC" value={formatCurrency(intelligence.summary.cac, currency)} />
            <KPICard
              label="ROAS"
              value={`${intelligence.summary.roas.toFixed(2)}x`}
              trend={intelligence.trend.map((row) =>
                row.spend > 0 ? row.conversionValue / row.spend : 0
              )}
            />
            <KPICard
              label="Conversions"
              value={formatNumber(intelligence.summary.conversions)}
              trend={intelligence.trend.map((row) => row.conversions)}
            />
            <KPICard
              label="Top Country Revenue"
              value={topLocation ? formatCurrency(topLocation.conversionValue, currency) : "--"}
              helper={topLocation ? topLocation.label : "No location data"}
            />
          </div>

          <DualTrendChart
            currency={currency}
            points={intelligence.trend.map((row) => ({
              date: row.date,
              spend: row.spend,
              revenue: row.conversionValue
            }))}
          />

          {intelligence.warnings.length ? (
            <div className="space-y-2">
              {intelligence.warnings.map((warning) => (
                <div key={warning} className="alert">
                  {warning}
                </div>
              ))}
            </div>
          ) : null}

          <div className="space-y-4">
            <Tabs
              ariaLabel="Ads breakdowns"
              items={tabItems}
              activeKey={activeTab}
              buildHref={(key) => tabHref(key as AdsTabKey)}
            />

            {activeTab === "campaigns" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="label">Campaign details</div>
                  <a className="text-xs text-ocean" href={detailHref("campaigns")}>
                    View all
                  </a>
                </div>
                <ReportsDataTable
                  title="Campaign details"
                  dimensionLabel="Campaign"
                  currency={currency}
                  columns={[
                    { label: "Spend", formatType: "currency" },
                    { label: "Revenue", formatType: "currency" },
                    { label: "Clicks" },
                    { label: "Impressions" },
                    { label: "Conversions" },
                    { label: "CPC", formatType: "currency" },
                    { label: "CPA", formatType: "currency" },
                    { label: "ROAS" }
                  ]}
                  rows={intelligence.campaigns.map((row) => ({
                    label: row.label,
                    values: [
                      row.spend,
                      row.conversionValue,
                      row.clicks,
                      row.impressions,
                      row.conversions,
                      row.cpc,
                      row.cpa,
                      row.roas
                    ]
                  }))}
                />
              </div>
            )}

            {activeTab === "products" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="label">Product spend vs revenue</div>
                  <a className="text-xs text-ocean" href={detailHref("products")}>
                    View all
                  </a>
                </div>
                <ReportsDataTable
                  title="Products"
                  dimensionLabel="Product"
                  currency={currency}
                  columns={[
                    { label: "Spend", formatType: "currency" },
                    { label: "Revenue", formatType: "currency" },
                    { label: "Clicks" },
                    { label: "Impressions" },
                    { label: "Conversions" },
                    { label: "ROAS" }
                  ]}
                  rows={intelligence.products.map((row) => ({
                    label: row.label,
                    values: [
                      row.spend,
                      row.conversionValue,
                      row.clicks,
                      row.impressions,
                      row.conversions,
                      row.roas
                    ]
                  }))}
                />
              </div>
            )}

            {activeTab === "locations" && (
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="label">Country revenue &amp; spend</div>
                    <a className="text-xs text-ocean" href={detailHref("locations-country")}>
                      View all
                    </a>
                  </div>
                  <ReportsDataTable
                    title="Country performance"
                    dimensionLabel="Country"
                    currency={currency}
                    columns={[
                      { label: "Revenue", formatType: "currency" },
                      { label: "Spend", formatType: "currency" },
                      { label: "Conversions" },
                      { label: "ROAS" }
                    ]}
                    rows={intelligence.locationCountries.map((row) => ({
                      label: row.label,
                      values: [row.conversionValue, row.spend, row.conversions, row.roas]
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="label">City revenue &amp; spend</div>
                    <a className="text-xs text-ocean" href={detailHref("locations-city")}>
                      View all
                    </a>
                  </div>
                  <ReportsDataTable
                    title="City performance"
                    dimensionLabel="City"
                    currency={currency}
                    columns={[
                      { label: "Revenue", formatType: "currency" },
                      { label: "Spend", formatType: "currency" },
                      { label: "Conversions" },
                      { label: "ROAS" }
                    ]}
                    rows={intelligence.locationCities.map((row) => ({
                      label: row.label,
                      values: [row.conversionValue, row.spend, row.conversions, row.roas]
                    }))}
                  />
                </div>
              </div>
            )}

            {activeTab === "keywords" && (
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="label">Top keywords</div>
                    <a className="text-xs text-ocean" href={detailHref("keywords")}>
                      View all
                    </a>
                  </div>
                  <ReportsDataTable
                    title="Top keywords"
                    dimensionLabel="Keyword"
                    currency={currency}
                    columns={[
                      { label: "Spend", formatType: "currency" },
                      { label: "Revenue", formatType: "currency" },
                      { label: "Clicks" },
                      { label: "Conversions" },
                      { label: "CPA", formatType: "currency" },
                      { label: "ROAS" }
                    ]}
                    rows={intelligence.keywords.map((row) => ({
                      label: row.label,
                      values: [
                        row.spend,
                        row.conversionValue,
                        row.clicks,
                        row.conversions,
                        row.cpa,
                        row.roas
                      ]
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="label">Negative keyword candidates</div>
                    <a className="text-xs text-ocean" href={detailHref("negative-keywords")}>
                      View all
                    </a>
                  </div>
                  <ReportsDataTable
                    title="Negative keyword candidates"
                    dimensionLabel="Search term"
                    currency={currency}
                    columns={[
                      { label: "Spend", formatType: "currency" },
                      { label: "Clicks" },
                      { label: "Impressions" },
                      { label: "Conversions" },
                      { label: "Revenue", formatType: "currency" }
                    ]}
                    rows={intelligence.negativeKeywordCandidates.map((row) => ({
                      label: row.label,
                      values: [
                        row.spend,
                        row.clicks,
                        row.impressions,
                        row.conversions,
                        row.conversionValue
                      ]
                    }))}
                  />
                </div>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
