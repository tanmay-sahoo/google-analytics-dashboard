import { prisma } from "@/lib/prisma";
import { formatDateShort } from "@/lib/time";
import { formatCurrency, formatNumber } from "@/lib/format";
import { getOrRefreshReport } from "@/lib/report-cache";
import { fetchAdsIntelligence, type AdsIntelligenceData } from "@/lib/ads-intelligence";
import { fetchGa4CityMetrics, type Ga4CityRow } from "@/lib/ga4";
import KPICard from "@/components/KPICard";
import DualTrendChart from "@/components/DualTrendChart";
import ReportsDataTable from "@/components/ReportsDataTable";
import AdsBreakdownTabs from "@/components/AdsBreakdownTabs";
import { BASE_PATH } from "@/lib/base-path";

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

export default async function AdsIntelligenceContent({
  projectId,
  start,
  end,
  rangeKey,
  forceRefresh,
  requestedTab
}: {
  projectId: string;
  start: Date;
  end: Date;
  rangeKey: string;
  forceRefresh: boolean;
  requestedTab?: string;
}) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { dataSources: true }
  });
  if (!project) return <div className="alert">Project not found.</div>;

  const adsSource = project.dataSources.find((item) => item.type === "ADS")?.externalId;
  const ga4Source = project.dataSources.find((item) => item.type === "GA4")?.externalId;
  const [adsIntegration, ga4Integration] = await Promise.all([
    prisma.integrationSetting.findUnique({ where: { type: "ADS" } }),
    prisma.integrationSetting.findUnique({ where: { type: "GA4" } })
  ]);

  let intelligence: AdsIntelligenceData | null = null;
  let errorMessage: string | null = null;
  let ga4Cities: Ga4CityRow[] = [];
  let ga4CityWarning: string | null = null;

  if (!adsSource || !adsIntegration?.refreshToken) {
    errorMessage = "Google Ads is not connected for this project.";
  } else {
    try {
      intelligence = await getOrRefreshReport({
        projectId: project.id,
        reportKey: "ads-intelligence:v15",
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

  if (ga4Source && ga4Integration?.refreshToken) {
    try {
      const cached = await getOrRefreshReport({
        projectId: project.id,
        reportKey: "ga4-cities:v1",
        rangeStart: start,
        rangeEnd: end,
        fetcher: () =>
          fetchGa4CityMetrics({
            propertyId: ga4Source,
            refreshToken: ga4Integration.refreshToken!,
            startDate: formatDateShort(start),
            endDate: formatDateShort(end),
            limit: 300
          }),
        force: forceRefresh
      });
      ga4Cities = Array.isArray(cached) ? cached : [];
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      ga4CityWarning = `Failed to fetch GA4 city data. ${message}`;
    }
  } else {
    ga4CityWarning = "GA4 is not connected for this project — city breakdown unavailable.";
  }

  const currency = project.currency;
  const topLocation = intelligence?.locationCountries?.[0] ?? null;
  const filterParams = new URLSearchParams({
    projectId: project.id,
    range: rangeKey,
    start: formatDateShort(start),
    end: formatDateShort(end)
  }).toString();
  const detailHref = (key: string) => `${BASE_PATH}/ads/${key}?${filterParams}`;

  const activeTab: AdsTabKey =
    requestedTab && ADS_TAB_KEYS.includes(requestedTab as AdsTabKey)
      ? (requestedTab as AdsTabKey)
      : "campaigns";

  return (
    <>
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

          <AdsBreakdownTabs
            ariaLabel="Ads breakdowns"
            defaultActiveKey={activeTab}
            tabs={[
              {
                key: "campaigns",
                label: "Campaigns",
                count: intelligence.campaigns.length,
                content: (
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
                )
              },
              {
                key: "products",
                label: "Products",
                count: intelligence.products.length,
                content: (
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
                )
              },
              {
                key: "locations",
                label: "Locations",
                count: intelligence.locationCountries.length + ga4Cities.length,
                content: (
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
                        <div className="label">City traffic &amp; revenue (GA4)</div>
                        <a className="text-xs text-ocean" href={detailHref("locations-city")}>
                          View all
                        </a>
                      </div>
                      <div className="text-xs text-slate/50">Source: Google Analytics</div>
                      {ga4CityWarning ? <div className="alert">{ga4CityWarning}</div> : null}
                      <ReportsDataTable
                        title="City performance"
                        dimensionLabel="City"
                        currency={currency}
                        columns={[
                          { label: "Sessions" },
                          { label: "Users" },
                          { label: "Conversions" },
                          { label: "Revenue", formatType: "currency" }
                        ]}
                        rows={ga4Cities.map((row) => ({
                          label: row.label,
                          values: [row.sessions, row.users, row.conversions, row.revenue]
                        }))}
                      />
                    </div>
                  </div>
                )
              },
              {
                key: "keywords",
                label: "Keywords",
                count: intelligence.keywords.length + intelligence.negativeKeywordCandidates.length,
                content: (
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
                          { label: "Impressions" },
                          { label: "Clicks" },
                          { label: "Spend", formatType: "currency" },
                          { label: "Conversions" },
                          { label: "Revenue", formatType: "currency" }
                        ]}
                        rows={intelligence.keywords.map((row) => ({
                          label: row.label,
                          values: [
                            row.impressions,
                            row.clicks,
                            row.spend,
                            row.conversions,
                            row.conversionValue
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
                )
              }
            ]}
          />
        </>
      ) : null}
    </>
  );
}
