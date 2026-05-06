import { addDays } from "@/lib/time";
import { readUserFilterPrefs, type FilterRangeKey } from "@/lib/filter-prefs";

type ProjectLike = { id: string };

type ResolvedFilters = {
  projectId: string;
  rangeKey: FilterRangeKey;
  start: Date;
  end: Date;
  urlHadRange: boolean;
  urlHadProject: boolean;
};

function rangeFromKey(rangeKey: FilterRangeKey, startParam?: string, endParam?: string) {
  const end = endParam ? new Date(endParam) : new Date();
  let start = startParam ? new Date(startParam) : addDays(end, -29);
  if (rangeKey === "last7") start = addDays(end, -6);
  else if (rangeKey === "last30") start = addDays(end, -29);
  else if (rangeKey === "last90") start = addDays(end, -89);
  else if (rangeKey === "month") start = new Date(end.getFullYear(), end.getMonth(), 1);
  return { start, end };
}

function isRangeKey(value: unknown): value is FilterRangeKey {
  return (
    value === "last7" ||
    value === "last30" ||
    value === "last90" ||
    value === "month" ||
    value === "custom"
  );
}

export async function resolveFiltersFromRequest({
  userId,
  projects,
  searchParams
}: {
  userId: string;
  projects: ProjectLike[];
  searchParams?: {
    projectId?: string;
    range?: string;
    start?: string;
    end?: string;
  };
}): Promise<ResolvedFilters | null> {
  if (!projects.length) return null;
  const prefs = await readUserFilterPrefs(userId);

  const urlProjectId = searchParams?.projectId;
  const urlHadProject = Boolean(urlProjectId);
  const urlValid = urlProjectId && projects.some((p) => p.id === urlProjectId);
  const prefValid = prefs.projectId && projects.some((p) => p.id === prefs.projectId);
  const projectId = urlValid
    ? urlProjectId!
    : prefValid
      ? prefs.projectId!
      : projects[0].id;

  const urlRange = searchParams?.range;
  const urlHadRange = isRangeKey(urlRange);

  let rangeKey: FilterRangeKey = "last30";
  let startParam = searchParams?.start;
  let endParam = searchParams?.end;

  if (urlHadRange) {
    rangeKey = urlRange;
  } else if (prefs.dateRange) {
    rangeKey = prefs.dateRange.range;
    if (rangeKey === "custom") {
      startParam = prefs.dateRange.start;
      endParam = prefs.dateRange.end;
    }
  }

  const { start, end } = rangeFromKey(rangeKey, startParam, endParam);

  return {
    projectId,
    rangeKey,
    start,
    end,
    urlHadRange,
    urlHadProject
  };
}
