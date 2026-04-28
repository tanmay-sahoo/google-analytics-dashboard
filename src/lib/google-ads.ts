import { getOAuthClient } from "@/lib/google-oauth";
import { addDays, formatDateShort } from "@/lib/time";
import { createLimiter, withRetry } from "@/lib/request-limiter";

export type AdsDailyMetrics = {
  date: Date;
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
  conversionValue: number;
  roas: number;
};

const adsLimiter = createLimiter(1);

function cleanCustomerId(id: string) {
  return id.replace(/-/g, "");
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  return value as Record<string, unknown>;
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

export async function fetchAdsDailyMetrics({
  customerId,
  refreshToken,
  startDate,
  endDate
}: {
  customerId: string;
  refreshToken: string;
  startDate?: string;
  endDate?: string;
}): Promise<AdsDailyMetrics[]> {
  const end = endDate ? new Date(endDate) : new Date();
  const start = startDate ? new Date(startDate) : addDays(end, -29);
  if (start > end) {
    return [];
  }
  const apiVersion = process.env.GOOGLE_ADS_API_VERSION ?? "v20";
  const headers = await getAdsHeaders(refreshToken);
  const normalizedCustomerId = cleanCustomerId(customerId);

  const query = `
    SELECT
      segments.date,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value
    FROM customer
    WHERE segments.date BETWEEN '${formatDateShort(start)}' AND '${formatDateShort(end)}'
    ORDER BY segments.date
  `;

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
    }, { label: "ads" })
  );

  return rows.map((row) => {
    const record = asObject(row);
    const segments = asObject(record.segments);
    const metrics = asObject(record.metrics);
    const date = new Date(String(segments.date ?? ""));
    const spendMicros = Number(metrics.costMicros ?? metrics.cost_micros ?? 0);
    const spend = spendMicros / 1_000_000;
    const conversions = Number(metrics.conversions ?? 0);
    const revenue = Number(metrics.conversionsValue ?? metrics.conversions_value ?? 0);
    const roas = spend > 0 ? Number((revenue / spend).toFixed(2)) : 0;

    return {
      date,
      spend,
      clicks: Number(metrics.clicks ?? 0),
      impressions: Number(metrics.impressions ?? 0),
      conversions,
      conversionValue: revenue,
      roas
    };
  });
}
