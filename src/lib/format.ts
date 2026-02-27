export function formatNumber(value?: number | null) {
  if (value === undefined || value === null) return "--";
  return new Intl.NumberFormat("en-IN").format(value);
}

export function formatCurrency(value?: number | null, currency = "INR") {
  if (value === undefined || value === null) return "--";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(value);
}
