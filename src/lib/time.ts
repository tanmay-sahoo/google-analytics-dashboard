export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  next.setHours(0, 0, 0, 0);
  return next;
}

// Formats a Date as YYYY-MM-DD using local-time components. Dates in this app
// are built from local-time constructs (new Date(), new Date(y, m, 1),
// addDays(...)), so .toISOString().slice(0,10) would shift a day in non-UTC
// timezones — e.g. CET "April 1" becomes "March 31" in UTC.
export function formatDateShort(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export const formatLocalDate = formatDateShort;
