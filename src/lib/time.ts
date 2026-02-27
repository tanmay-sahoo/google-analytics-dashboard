export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function formatDateShort(date: Date) {
  return date.toISOString().slice(0, 10);
}
