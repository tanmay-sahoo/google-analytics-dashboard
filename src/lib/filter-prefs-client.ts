import { apiUrl } from "@/lib/base-path";
import type { FilterPrefs } from "@/lib/filter-prefs";

export type { FilterPrefs };

export function saveFilterPrefs(patch: FilterPrefs) {
  if (typeof window === "undefined") return;
  void fetch(apiUrl("/api/account/preferences"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filterPrefs: patch })
  }).catch(() => {
    // best-effort; server defaults still work if this fails
  });
}
