import { prisma } from "@/lib/prisma";
import { createLimiter, withRetry } from "@/lib/request-limiter";
import { getOAuthClient } from "@/lib/google-oauth";

type NumericLike = number | string | null | undefined;

export type AdsKpis = {
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
  conversionValue: number;
  cpc: number;
  cpm: number;
  ctr: number;
  cpa: number;
  cac: number;
  roas: number;
};

export type AdsTrendPoint = {
  date: string;
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
  conversionValue: number;
};

export type AdsBreakdownRow = {
  label: string;
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
  conversionValue: number;
  cpc: number;
  cpa: number;
  roas: number;
};

export type AdsProjectComparisonRow = {
  projectId: string;
  projectName: string;
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
  conversionValue: number;
  cpc: number;
  cpm: number;
  ctr: number;
  cpa: number;
  cac: number;
  roas: number;
};

export type AdsIntelligenceData = {
  summary: AdsKpis;
  trend: AdsTrendPoint[];
  products: AdsBreakdownRow[];
  campaigns: AdsBreakdownRow[];
  locationCountries: AdsBreakdownRow[];
  locationCities: AdsBreakdownRow[];
  keywords: AdsBreakdownRow[];
  negativeKeywordCandidates: AdsBreakdownRow[];
  warnings: string[];
  fetchedAt: string;
};

const adsLimiter = createLimiter(1);

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function parseNumber(value: NumericLike) {
  const next = Number(value ?? 0);
  return Number.isFinite(next) ? next : 0;
}

function cleanCustomerId(value: string) {
  return value.replace(/-/g, "");
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  return value as Record<string, unknown>;
}

function pickFirst<T>(...values: Array<T | undefined>) {
  for (const value of values) {
    if (value !== undefined) return value;
  }
  return undefined;
}

function extractMetrics(row: unknown) {
  const record = asObject(row);
  const metrics = asObject(record.metrics);
  const spendMicros = parseNumber(
    pickFirst(metrics.costMicros as NumericLike, metrics.cost_micros as NumericLike)
  );
  const spend = spendMicros / 1_000_000;
  const clicks = parseNumber(metrics.clicks as NumericLike);
  const impressions = parseNumber(metrics.impressions as NumericLike);
  const conversions = parseNumber(
    pickFirst(
      metrics.conversions as NumericLike,
      metrics.allConversions as NumericLike,
      metrics.all_conversions as NumericLike
    )
  );
  const conversionValue = parseNumber(
    pickFirst(
      metrics.conversionsValue as NumericLike,
      metrics.conversions_value as NumericLike,
      metrics.allConversionsValue as NumericLike,
      metrics.all_conversions_value as NumericLike
    )
  );
  return { spend, clicks, impressions, conversions, conversionValue };
}

function buildKpis(base: {
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
  conversionValue: number;
}): AdsKpis {
  const cpc = base.clicks > 0 ? base.spend / base.clicks : 0;
  const cpm = base.impressions > 0 ? (base.spend * 1000) / base.impressions : 0;
  const ctr = base.impressions > 0 ? (base.clicks / base.impressions) * 100 : 0;
  const cpa = base.conversions > 0 ? base.spend / base.conversions : 0;
  const roas = base.spend > 0 ? base.conversionValue / base.spend : 0;
  return {
    spend: round2(base.spend),
    clicks: round2(base.clicks),
    impressions: round2(base.impressions),
    conversions: round2(base.conversions),
    conversionValue: round2(base.conversionValue),
    cpc: round2(cpc),
    cpm: round2(cpm),
    ctr: round2(ctr),
    cpa: round2(cpa),
    cac: round2(cpa),
    roas: round2(roas)
  };
}

function toBreakdownRow(
  label: string,
  base: { spend: number; clicks: number; impressions: number; conversions: number; conversionValue: number }
): AdsBreakdownRow {
  const cpc = base.clicks > 0 ? base.spend / base.clicks : 0;
  const cpa = base.conversions > 0 ? base.spend / base.conversions : 0;
  const roas = base.spend > 0 ? base.conversionValue / base.spend : 0;
  return {
    label,
    spend: round2(base.spend),
    clicks: round2(base.clicks),
    impressions: round2(base.impressions),
    conversions: round2(base.conversions),
    conversionValue: round2(base.conversionValue),
    cpc: round2(cpc),
    cpa: round2(cpa),
    roas: round2(roas)
  };
}

function parseAdsErrorMessage(raw: string) {
  try {
    const parsed = JSON.parse(raw) as {
      error?: {
        message?: string;
        details?: Array<{
          errors?: Array<{ message?: string }>;
        }>;
      };
    };
    const detailMessage = parsed.error?.details?.[0]?.errors?.[0]?.message;
    return detailMessage ?? parsed.error?.message ?? raw;
  } catch {
    return raw;
  }
}

async function getAdsHeaders(refreshToken: string) {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "";
  if (!developerToken) {
    throw new Error("Missing GOOGLE_ADS_DEVELOPER_TOKEN");
  }

  const oauthClient = getOAuthClient();
  oauthClient.setCredentials({ refresh_token: refreshToken });
  const accessToken = (await oauthClient.getAccessToken()).token;
  if (!accessToken) {
    throw new Error("Failed to obtain Google Ads access token");
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": developerToken,
    "content-type": "application/json"
  };

  const loginCustomerId = process.env.GOOGLE_ADS_MANAGER_CUSTOMER_ID;
  if (loginCustomerId) {
    headers["login-customer-id"] = cleanCustomerId(loginCustomerId);
  }

  return headers;
}

async function runAdsSearchStream({
  customerId,
  refreshToken,
  query
}: {
  customerId: string;
  refreshToken: string;
  query: string;
}): Promise<Array<Record<string, unknown>>> {
  const apiVersion = process.env.GOOGLE_ADS_API_VERSION ?? "v19";
  const headers = await getAdsHeaders(refreshToken);
  const normalizedCustomerId = cleanCustomerId(customerId);

  const rows = await adsLimiter(() =>
    withRetry(async () => {
      const response = await fetch(
        `https://googleads.googleapis.com/${apiVersion}/customers/${normalizedCustomerId}/googleAds:searchStream`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ query })
        }
      );
      if (!response.ok) {
        const raw = await response.text();
        const error = new Error(parseAdsErrorMessage(raw)) as Error & { code?: number };
        error.code = response.status;
        throw error;
      }

      const chunks = (await response.json()) as Array<{ results?: Array<Record<string, unknown>> }>;
      return chunks.flatMap((chunk) => chunk.results ?? []);
    }, { label: "ads-intel" })
  );

  return rows;
}

async function runAdsSearchStreamFirstSuccess({
  customerId,
  refreshToken,
  queries
}: {
  customerId: string;
  refreshToken: string;
  queries: string[];
}) {
  let lastError: unknown = null;
  for (const query of queries) {
    try {
      const rows = await runAdsSearchStream({ customerId, refreshToken, query });
      return { rows, error: null as unknown };
    } catch (error) {
      lastError = error;
    }
  }
  return { rows: [] as Array<Record<string, unknown>>, error: lastError };
}

async function resolveGeoNames({
  customerId,
  refreshToken,
  resources
}: {
  customerId: string;
  refreshToken: string;
  resources: string[];
}) {
  const unique = Array.from(
    new Set(
      resources
        .map((value) => value.trim())
        .filter((value) => value.length > 0 && value !== "UNSPECIFIED")
    )
  );
  if (!unique.length) {
    return new Map<string, string>();
  }

  const map = new Map<string, string>();
  const toResourceName = (value: string) => {
    if (value.startsWith("geoTargetConstants/")) return value;
    if (value.startsWith("geo_target_constants/")) {
      return value.replace("geo_target_constants/", "geoTargetConstants/");
    }
    if (/^\d+$/.test(value)) return `geoTargetConstants/${value}`;
    return value;
  };
  const toCriterionId = (value: string) => {
    if (/^\d+$/.test(value)) return value;
    const normalized = toResourceName(value);
    if (!normalized.startsWith("geoTargetConstants/")) return "";
    return normalized.split("/").pop() ?? "";
  };

  const normalizedResources = Array.from(new Set(unique.map((value) => toResourceName(value))));
  const normalizedIds = Array.from(
    new Set(
      unique
        .map((value) => toCriterionId(value))
        .filter((value) => /^\d+$/.test(value))
    )
  );

  const batchSize = 60;
  for (let index = 0; index < normalizedResources.length; index += batchSize) {
    const chunk = normalizedResources.slice(index, index + batchSize);
    const inClause = chunk.map((value) => `'${value.replace(/'/g, "\\'")}'`).join(", ");
    try {
      const rows = await runAdsSearchStream({
        customerId,
        refreshToken,
        query: `
          SELECT
            geo_target_constant.resource_name,
            geo_target_constant.id,
            geo_target_constant.name
          FROM geo_target_constant
          WHERE geo_target_constant.resource_name IN (${inClause})
        `
      });

      for (const row of rows) {
        const geo = asObject(asObject(row).geoTargetConstant);
        const legacyGeo = asObject(asObject(row).geo_target_constant);
        const resourceName = String(
          pickFirst(
            geo.resourceName as string | undefined,
            legacyGeo.resource_name as string | undefined
          ) ?? ""
        );
        const criterionId = String(
          pickFirst(geo.id as string | number | undefined, legacyGeo.id as string | number | undefined) ?? ""
        );
        const name = String(
          pickFirst(geo.name as string | undefined, legacyGeo.name as string | undefined) ?? ""
        );
        if (name) {
          if (resourceName) {
            map.set(resourceName, name);
          }
          if (criterionId) {
            map.set(criterionId, name);
            map.set(`geoTargetConstants/${criterionId}`, name);
          }
        }
      }
    } catch {
      // Best-effort only.
    }
  }

  for (let index = 0; index < normalizedIds.length; index += batchSize) {
    const chunk = normalizedIds.slice(index, index + batchSize);
    const inClause = chunk.join(", ");
    try {
      const rows = await runAdsSearchStream({
        customerId,
        refreshToken,
        query: `
          SELECT
            geo_target_constant.resource_name,
            geo_target_constant.id,
            geo_target_constant.name
          FROM geo_target_constant
          WHERE geo_target_constant.id IN (${inClause})
        `
      });

      for (const row of rows) {
        const geo = asObject(asObject(row).geoTargetConstant);
        const legacyGeo = asObject(asObject(row).geo_target_constant);
        const resourceName = String(
          pickFirst(
            geo.resourceName as string | undefined,
            legacyGeo.resource_name as string | undefined
          ) ?? ""
        );
        const criterionId = String(
          pickFirst(geo.id as string | number | undefined, legacyGeo.id as string | number | undefined) ?? ""
        );
        const name = String(
          pickFirst(geo.name as string | undefined, legacyGeo.name as string | undefined) ?? ""
        );
        if (name) {
          if (resourceName) {
            map.set(resourceName, name);
          }
          if (criterionId) {
            map.set(criterionId, name);
            map.set(`geoTargetConstants/${criterionId}`, name);
          }
        }
      }
    } catch {
      // Best-effort only.
    }
  }
  return map;
}

function fallbackGeoLabel(resource: string, prefix: string) {
  if (!resource) return `${prefix} Unknown`;
  const normalized = resource.startsWith("geo_target_constants/")
    ? resource.replace("geo_target_constants/", "geoTargetConstants/")
    : resource;
  const id = normalized.includes("/") ? normalized.split("/").pop() ?? normalized : normalized;
  return `${prefix} ${id}`;
}

function extractCountryResourceFromRow(row: unknown) {
  const record = asObject(row);
  const segments = asObject(record.segments);
  const geographicView = asObject(record.geographicView);
  const legacyGeographicView = asObject(record.geographic_view);
  const userLocationView = asObject(record.userLocationView);
  const legacyUserLocationView = asObject(record.user_location_view);

  const fromSegments = String(
    pickFirst(
      segments.geoTargetCountry as string | undefined,
      segments.geo_target_country as string | undefined
    ) ?? ""
  );
  if (fromSegments && fromSegments !== "UNSPECIFIED") return fromSegments;

  const criterionId = String(
    pickFirst(
      geographicView.countryCriterionId as string | number | undefined,
      legacyGeographicView.country_criterion_id as string | number | undefined,
      userLocationView.countryCriterionId as string | number | undefined,
      legacyUserLocationView.country_criterion_id as string | number | undefined
    ) ?? ""
  );
  if (/^\d+$/.test(criterionId)) return `geoTargetConstants/${criterionId}`;
  return "";
}

function extractCityResourceFromRow(row: unknown) {
  const record = asObject(row);
  const segments = asObject(record.segments);
  const geographicView = asObject(record.geographicView);
  const legacyGeographicView = asObject(record.geographic_view);
  const userLocationView = asObject(record.userLocationView);
  const legacyUserLocationView = asObject(record.user_location_view);

  const fromSegments = String(
    pickFirst(segments.geoTargetCity as string | undefined, segments.geo_target_city as string | undefined) ?? ""
  );
  if (fromSegments && fromSegments !== "UNSPECIFIED") return fromSegments;

  const criterionId = String(
    pickFirst(
      geographicView.cityCriterionId as string | number | undefined,
      legacyGeographicView.city_criterion_id as string | number | undefined,
      userLocationView.cityCriterionId as string | number | undefined,
      legacyUserLocationView.city_criterion_id as string | number | undefined
    ) ?? ""
  );
  if (/^\d+$/.test(criterionId)) return `geoTargetConstants/${criterionId}`;
  return "";
}

function aggregateBreakdownRows(rows: AdsBreakdownRow[]) {
  const aggregates = new Map<
    string,
    { spend: number; clicks: number; impressions: number; conversions: number; conversionValue: number }
  >();

  for (const row of rows) {
    const current = aggregates.get(row.label) ?? {
      spend: 0,
      clicks: 0,
      impressions: 0,
      conversions: 0,
      conversionValue: 0
    };
    current.spend += row.spend;
    current.clicks += row.clicks;
    current.impressions += row.impressions;
    current.conversions += row.conversions;
    current.conversionValue += row.conversionValue;
    aggregates.set(row.label, current);
  }

  return Array.from(aggregates.entries())
    .map(([label, base]) => toBreakdownRow(label, base))
    .sort((a, b) => b.spend - a.spend || b.conversionValue - a.conversionValue);
}

export async function fetchAdsIntelligence({
  customerId,
  refreshToken,
  startDate,
  endDate
}: {
  customerId: string;
  refreshToken: string;
  startDate: string;
  endDate: string;
}): Promise<AdsIntelligenceData> {
  const warnings: string[] = [];

  const summaryRows = await runAdsSearchStream({
    customerId,
    refreshToken,
    query: `
      SELECT
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value
      FROM customer
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
    `
  });

  const summaryBase = summaryRows.reduce<{
    spend: number;
    clicks: number;
    impressions: number;
    conversions: number;
    conversionValue: number;
  }>(
    (acc, row) => {
      const next = extractMetrics(row);
      acc.spend += next.spend;
      acc.clicks += next.clicks;
      acc.impressions += next.impressions;
      acc.conversions += next.conversions;
      acc.conversionValue += next.conversionValue;
      return acc;
    },
    { spend: 0, clicks: 0, impressions: 0, conversions: 0, conversionValue: 0 }
  );

  const trendRows = await runAdsSearchStream({
    customerId,
    refreshToken,
    query: `
      SELECT
        segments.date,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value
      FROM customer
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      ORDER BY segments.date
    `
  });

  const trend = trendRows.map((row) => {
    const segments = asObject(asObject(row).segments);
    const metrics = extractMetrics(row);
    const date = String(pickFirst(segments.date as string | undefined) ?? "");
    return {
      date,
      spend: round2(metrics.spend),
      clicks: round2(metrics.clicks),
      impressions: round2(metrics.impressions),
      conversions: round2(metrics.conversions),
      conversionValue: round2(metrics.conversionValue)
    };
  });

  const campaigns = await (async () => {
    try {
      const rows = await runAdsSearchStream({
        customerId,
        refreshToken,
        query: `
          SELECT
            campaign.id,
            campaign.name,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions,
            metrics.conversions_value
          FROM campaign
          WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
          ORDER BY metrics.cost_micros DESC
          LIMIT 300
        `
      });
      const mapped = rows
        .map((row) => {
          const campaign = asObject(asObject(row).campaign);
          const legacyCampaign = asObject(asObject(row).campaign);
          const id = String(
            pickFirst(
              campaign.id as string | number | undefined,
              legacyCampaign.id as string | number | undefined
            ) ?? ""
          );
          const name = String(
            pickFirst(campaign.name as string | undefined, legacyCampaign.name as string | undefined) ??
              ""
          ).trim();
          const label = name || `Campaign ${id}` || "Unknown campaign";
          return toBreakdownRow(label, extractMetrics(row));
        })
        .filter((row) => row.spend > 0 || row.clicks > 0 || row.conversionValue > 0);
      return aggregateBreakdownRows(mapped).slice(0, 300);
    } catch {
      warnings.push("Campaign breakdown is unavailable for this account/range.");
      return [] as AdsBreakdownRow[];
    }
  })();

  const products = await (async () => {
    try {
      const rows = await runAdsSearchStream({
        customerId,
        refreshToken,
        query: `
          SELECT
            segments.product_item_id,
            segments.product_title,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions,
            metrics.conversions_value
          FROM shopping_performance_view
          WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
          ORDER BY metrics.cost_micros DESC
          LIMIT 300
        `
      });

      const mapped = rows
        .map((row) => {
          const segments = asObject(asObject(row).segments);
          const productId = String(
            pickFirst(
              segments.productItemId as string | undefined,
              segments.product_item_id as string | undefined
            ) ?? ""
          ).trim();
          const productTitle = String(
            pickFirst(
              segments.productTitle as string | undefined,
              segments.product_title as string | undefined
            ) ?? ""
          ).trim();
          const label = productTitle || productId || "Unknown product";
          return toBreakdownRow(label, extractMetrics(row));
        })
        .filter((row) => row.label.length > 0);
      return aggregateBreakdownRows(mapped).slice(0, 300);
    } catch {
      warnings.push("Product-level Ads breakdown is unavailable for this account/range.");
      return [] as AdsBreakdownRow[];
    }
  })();

  const locationCountries = await (async () => {
    const { rows, error } = await runAdsSearchStreamFirstSuccess({
      customerId,
      refreshToken,
      queries: [
        `
          SELECT
            segments.geo_target_country,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions,
            metrics.conversions_value
          FROM campaign
          WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
          ORDER BY metrics.conversions_value DESC
          LIMIT 300
        `,
        `
          SELECT
            geographic_view.country_criterion_id,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions,
            metrics.conversions_value
          FROM geographic_view
          WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
          ORDER BY metrics.conversions_value DESC
          LIMIT 300
        `,
        `
          SELECT
            user_location_view.country_criterion_id,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions,
            metrics.conversions_value
          FROM user_location_view
          WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
          ORDER BY metrics.conversions_value DESC
          LIMIT 300
        `
      ]
    });
    try {
      if (!rows.length && error) {
        throw error;
      }

      const countryResources = rows
        .map((row) => extractCountryResourceFromRow(row))
        .filter((value) => value.length > 0 && value !== "UNSPECIFIED");
      const names = await resolveGeoNames({ customerId, refreshToken, resources: countryResources });

      const mapped = rows
        .map((row) => {
          const countryResource = extractCountryResourceFromRow(row);
          if (!countryResource || countryResource === "UNSPECIFIED") return null;
          const label = names.get(countryResource) ?? fallbackGeoLabel(countryResource, "Country");
          return toBreakdownRow(label, extractMetrics(row));
        })
        .filter((row): row is AdsBreakdownRow => Boolean(row))
        .filter((row) => row.spend > 0 || row.conversionValue > 0 || row.clicks > 0);
      return aggregateBreakdownRows(mapped).slice(0, 300);
    } catch {
      warnings.push("Country-level location breakdown is unavailable for this account/range.");
      return [] as AdsBreakdownRow[];
    }
  })();

  const locationCities = await (async () => {
    const { rows, error } = await runAdsSearchStreamFirstSuccess({
      customerId,
      refreshToken,
      queries: [
        `
          SELECT
            segments.geo_target_city,
            segments.geo_target_country,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions,
            metrics.conversions_value
          FROM campaign
          WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
          ORDER BY metrics.conversions_value DESC
          LIMIT 300
        `,
        `
          SELECT
            geographic_view.city_criterion_id,
            geographic_view.country_criterion_id,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions,
            metrics.conversions_value
          FROM geographic_view
          WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
          ORDER BY metrics.conversions_value DESC
          LIMIT 300
        `,
        `
          SELECT
            user_location_view.city_criterion_id,
            user_location_view.country_criterion_id,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions,
            metrics.conversions_value
          FROM user_location_view
          WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
          ORDER BY metrics.conversions_value DESC
          LIMIT 300
        `
      ]
    });
    try {
      if (!rows.length && error) {
        throw error;
      }

      const resources = rows.flatMap((row) => {
        const city = extractCityResourceFromRow(row);
        const country = extractCountryResourceFromRow(row);
        return [city, country];
      });
      const names = await resolveGeoNames({ customerId, refreshToken, resources });

      const mapped = rows
        .map((row) => {
          const cityResource = extractCityResourceFromRow(row);
          const countryResource = extractCountryResourceFromRow(row);
          if (!cityResource || cityResource === "UNSPECIFIED") return null;
          const city = names.get(cityResource) ?? fallbackGeoLabel(cityResource, "City");
          const country =
            names.get(countryResource) ??
            (countryResource && countryResource !== "UNSPECIFIED"
              ? fallbackGeoLabel(countryResource, "Country")
              : "");
          const label = country ? `${city}, ${country}` : city;
          return toBreakdownRow(label, extractMetrics(row));
        })
        .filter((row): row is AdsBreakdownRow => Boolean(row))
        .filter((row) => row.spend > 0 || row.conversionValue > 0 || row.clicks > 0);
      return aggregateBreakdownRows(mapped).slice(0, 300);
    } catch {
      warnings.push("City-level location breakdown is unavailable for this account/range.");
      return [] as AdsBreakdownRow[];
    }
  })();

  const keywords = await (async () => {
    try {
      const rows = await runAdsSearchStream({
        customerId,
        refreshToken,
        query: `
          SELECT
            ad_group_criterion.keyword.text,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions,
            metrics.conversions_value
          FROM keyword_view
          WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
          ORDER BY metrics.cost_micros DESC
          LIMIT 300
        `
      });

      const mapped = rows
        .map((row) => {
          const criterion = asObject(asObject(row).adGroupCriterion);
          const keyword = asObject(criterion.keyword);
          const legacyCriterion = asObject(asObject(row).ad_group_criterion);
          const legacyKeyword = asObject(legacyCriterion.keyword);
          const text = String(
            pickFirst(keyword.text as string | undefined, legacyKeyword.text as string | undefined) ??
              "Unknown keyword"
          );
          return toBreakdownRow(text, extractMetrics(row));
        })
        .filter((row) => row.label.length > 0);
      return aggregateBreakdownRows(mapped).slice(0, 300);
    } catch {
      warnings.push("Keyword breakdown is unavailable for this account/range.");
      return [] as AdsBreakdownRow[];
    }
  })();

  const negativeKeywordCandidates = await (async () => {
    try {
      const rows = await runAdsSearchStream({
        customerId,
        refreshToken,
        query: `
          SELECT
            search_term_view.search_term,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions,
            metrics.conversions_value
          FROM search_term_view
          WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
          ORDER BY metrics.cost_micros DESC
          LIMIT 300
        `
      });

      const mapped = rows
        .map((row) => {
          const view = asObject(asObject(row).searchTermView);
          const legacy = asObject(asObject(row).search_term_view);
          const term = String(
            pickFirst(view.searchTerm as string | undefined, legacy.search_term as string | undefined) ??
              "Unknown term"
          );
          return toBreakdownRow(term, extractMetrics(row));
        })
        .filter((row) => row.clicks >= 5 && row.conversions <= 0 && row.spend > 0)
        .sort((a, b) => b.spend - a.spend);
      return aggregateBreakdownRows(mapped).slice(0, 100);
    } catch {
      warnings.push("Search term breakdown is unavailable for this account/range.");
      return [] as AdsBreakdownRow[];
    }
  })();

  return {
    summary: buildKpis(summaryBase),
    trend,
    products,
    campaigns,
    locationCountries,
    locationCities,
    keywords,
    negativeKeywordCandidates,
    warnings,
    fetchedAt: new Date().toISOString()
  };
}

function readMetricNumber(metrics: unknown, keys: string[]) {
  const record = asObject(metrics);
  for (const key of keys) {
    if (key in record) {
      return parseNumber(record[key] as NumericLike);
    }
  }
  return 0;
}

export async function loadAdsProjectComparison({
  projectIds,
  start,
  end
}: {
  projectIds: string[];
  start: Date;
  end: Date;
}): Promise<AdsProjectComparisonRow[]> {
  if (!projectIds.length) return [];

  const [projects, rows] = await Promise.all([
    prisma.project.findMany({
      where: { id: { in: projectIds } },
      select: { id: true, name: true }
    }),
    prisma.metricDaily.findMany({
      where: {
        projectId: { in: projectIds },
        source: "ADS",
        date: { gte: start, lte: end }
      },
      select: { projectId: true, metrics: true }
    })
  ]);

  const projectMap = new Map<string, string>(projects.map((project) => [project.id, project.name]));
  const aggregates = new Map<
    string,
    { spend: number; clicks: number; impressions: number; conversions: number; conversionValue: number }
  >();

  for (const row of rows) {
    const current = aggregates.get(row.projectId) ?? {
      spend: 0,
      clicks: 0,
      impressions: 0,
      conversions: 0,
      conversionValue: 0
    };

    const spend = readMetricNumber(row.metrics, ["spend"]);
    const clicks = readMetricNumber(row.metrics, ["clicks"]);
    const impressions = readMetricNumber(row.metrics, ["impressions"]);
    const conversions = readMetricNumber(row.metrics, ["conversions"]);
    let conversionValue = readMetricNumber(row.metrics, ["conversionValue", "conversionsValue"]);

    if (conversionValue <= 0) {
      const roas = readMetricNumber(row.metrics, ["roas"]);
      if (roas > 0 && spend > 0) conversionValue = roas * spend;
    }

    current.spend += spend;
    current.clicks += clicks;
    current.impressions += impressions;
    current.conversions += conversions;
    current.conversionValue += conversionValue;
    aggregates.set(row.projectId, current);
  }

  return projectIds
    .map((projectId) => {
      const base = aggregates.get(projectId) ?? {
        spend: 0,
        clicks: 0,
        impressions: 0,
        conversions: 0,
        conversionValue: 0
      };
      const kpis = buildKpis(base);
      return {
        projectId,
        projectName: projectMap.get(projectId) ?? projectId,
        spend: kpis.spend,
        clicks: kpis.clicks,
        impressions: kpis.impressions,
        conversions: kpis.conversions,
        conversionValue: kpis.conversionValue,
        cpc: kpis.cpc,
        cpm: kpis.cpm,
        ctr: kpis.ctr,
        cpa: kpis.cpa,
        cac: kpis.cac,
        roas: kpis.roas
      };
    })
    .sort((a, b) => b.spend - a.spend);
}
