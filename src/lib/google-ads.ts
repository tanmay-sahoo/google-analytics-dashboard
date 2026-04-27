import { GoogleAdsApi } from "google-ads-api";
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

export async function fetchAdsDailyMetrics({
  customerId,
  refreshToken
}: {
  customerId: string;
  refreshToken: string;
}): Promise<AdsDailyMetrics[]> {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "";
  const loginCustomerId = process.env.GOOGLE_ADS_MANAGER_CUSTOMER_ID ?? undefined;

  const api = new GoogleAdsApi({
    client_id: clientId,
    client_secret: clientSecret,
    developer_token: developerToken
  });

  const customer = api.Customer({
    customer_id: cleanCustomerId(customerId),
    login_customer_id: loginCustomerId ? cleanCustomerId(loginCustomerId) : undefined,
    refresh_token: refreshToken
  });

  const end = new Date();
  const start = addDays(end, -29);

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
    withRetry(() => customer.query(query), { label: "ads" })
  );

  return rows.map((row: any) => {
    const date = new Date(row.segments.date);
    const spend = Number(row.metrics.cost_micros ?? 0) / 1_000_000;
    const conversions = Number(row.metrics.conversions ?? 0);
    const revenue = Number(row.metrics.conversions_value ?? 0);
    const roas = spend > 0 ? Number((revenue / spend).toFixed(2)) : 0;

    return {
      date,
      spend,
      clicks: Number(row.metrics.clicks ?? 0),
      impressions: Number(row.metrics.impressions ?? 0),
      conversions,
      conversionValue: revenue,
      roas
    };
  });
}
