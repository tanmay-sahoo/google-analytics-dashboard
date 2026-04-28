export type MetricSourceKey = "GA4" | "ADS";

export type MetricDefinition = {
  key: string;
  label: string;
  source: MetricSourceKey;
  format: "number" | "currency" | "percent" | "ratio";
};

export const METRICS_CATALOG: MetricDefinition[] = [
  { key: "sessions", label: "GA4 — Sessions", source: "GA4", format: "number" },
  { key: "users", label: "GA4 — Users", source: "GA4", format: "number" },
  { key: "conversions", label: "GA4 — Conversions", source: "GA4", format: "number" },
  { key: "revenue", label: "GA4 — Revenue", source: "GA4", format: "currency" },
  { key: "spend", label: "Ads — Spend", source: "ADS", format: "currency" },
  { key: "clicks", label: "Ads — Clicks", source: "ADS", format: "number" },
  { key: "impressions", label: "Ads — Impressions", source: "ADS", format: "number" },
  { key: "conversions_ads", label: "Ads — Conversions", source: "ADS", format: "number" },
  { key: "conversionValue", label: "Ads — Conversion value", source: "ADS", format: "currency" },
  { key: "roas", label: "Ads — ROAS", source: "ADS", format: "ratio" }
];

const BY_KEY = new Map(METRICS_CATALOG.map((item) => [item.key, item]));

export function getMetric(key: string) {
  return BY_KEY.get(key) ?? null;
}

export function getMetricSource(key: string): MetricSourceKey {
  // The Ads "conversions_ads" metric maps to the underlying "conversions" field on the Ads metric row.
  return BY_KEY.get(key)?.source ?? "GA4";
}

export function getMetricField(key: string): string {
  if (key === "conversions_ads") return "conversions";
  return key;
}

export function isValidMetric(key: string) {
  return BY_KEY.has(key);
}
