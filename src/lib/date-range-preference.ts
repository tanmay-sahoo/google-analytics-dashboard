export type DateRangeKey = "last7" | "last30" | "last90" | "month" | "custom";

export type SavedDateRange = {
  range: DateRangeKey;
  start?: string;
  end?: string;
};

const RANGE_KEYS: DateRangeKey[] = ["last7", "last30", "last90", "month", "custom"];

function storageKey(scope: string) {
  return `mdh:dateRange:${scope}`;
}

export function readDateRangePreference(scope: string): SavedDateRange | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (!RANGE_KEYS.includes(parsed.range)) return null;
    if (parsed.range === "custom") {
      if (typeof parsed.start !== "string" || typeof parsed.end !== "string") return null;
      return { range: "custom", start: parsed.start, end: parsed.end };
    }
    return { range: parsed.range as DateRangeKey };
  } catch {
    return null;
  }
}

export function saveDateRangePreference(scope: string, value: SavedDateRange) {
  if (typeof window === "undefined") return;
  try {
    const payload: SavedDateRange =
      value.range === "custom"
        ? { range: "custom", start: value.start, end: value.end }
        : { range: value.range };
    window.localStorage.setItem(storageKey(scope), JSON.stringify(payload));
  } catch {
    // best-effort — ignore quota or serialization errors
  }
}
