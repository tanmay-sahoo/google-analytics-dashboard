"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ProjectSelector from "@/components/ProjectSelector";
import { addDays, formatDateShort } from "@/lib/time";
import DateRangePicker from "@/components/DateRangePicker";

const rangeOptions = [
  { key: "last7", label: "Last 7 days" },
  { key: "last30", label: "Last 30 days" },
  { key: "last90", label: "Last 90 days" },
  { key: "month", label: "This month" },
  { key: "custom", label: "Custom range" }
] as const;

type RangeKey = (typeof rangeOptions)[number]["key"];

export default function ReportsFilters({
  projects,
  selectedProjectId,
  report,
  range,
  start,
  end,
  refresh,
  basePath = "/reports"
}: {
  projects: { id: string; name: string }[];
  selectedProjectId: string;
  report: string;
  range: RangeKey;
  start: string;
  end: string;
  refresh?: string;
  basePath?: string;
}) {
  const router = useRouter();
  const [customStart, setCustomStart] = useState(start);
  const [customEnd, setCustomEnd] = useState(end);
  const [selectedRange, setSelectedRange] = useState<RangeKey>(range);
  const [error, setError] = useState<string | null>(null);

  function resolveRangeDates(rangeKey: RangeKey, baseEnd: string) {
    const endDate = baseEnd ? new Date(baseEnd) : new Date();
    let startDate = endDate;
    if (rangeKey === "last7") {
      startDate = addDays(endDate, -6);
    } else if (rangeKey === "last30") {
      startDate = addDays(endDate, -29);
    } else if (rangeKey === "last90") {
      startDate = addDays(endDate, -89);
    } else if (rangeKey === "month") {
      startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    }
    return {
      start: formatDateShort(startDate),
      end: formatDateShort(endDate)
    };
  }

  async function prefetchReports({
    projectId,
    startDate,
    endDate,
    force
  }: {
    projectId: string;
    startDate: string;
    endDate: string;
    force: boolean;
  }) {
    try {
      await fetch("/api/reports/prefetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          start: startDate,
          end: endDate,
          force
        })
      });
    } catch (error) {
      // Ignore prefetch failures; the server-rendered page handles live fetching.
    }
  }

  function applyFilters({
    nextProjectId = selectedProjectId,
    forceRefresh = false,
    rangeOverride,
    customStartOverride,
    customEndOverride
  }: {
    nextProjectId?: string;
    forceRefresh?: boolean;
    rangeOverride?: RangeKey;
    customStartOverride?: string;
    customEndOverride?: string;
  } = {}) {
    setError(null);
    const effectiveRange = rangeOverride ?? selectedRange;
    const effectiveCustomStart = customStartOverride ?? customStart;
    const effectiveCustomEnd = customEndOverride ?? customEnd;
    let nextStart = start;
    let nextEnd = end;
    if (effectiveRange === "custom") {
      nextStart = effectiveCustomStart;
      nextEnd = effectiveCustomEnd;
      if (!nextStart || !nextEnd) {
        setError("Select both start and end dates.");
        return;
      }
      if (new Date(nextStart) > new Date(nextEnd)) {
        setError("Start date must be before end date.");
        return;
      }
    } else {
      const resolved = resolveRangeDates(selectedRange, end);
      nextStart = resolved.start;
      nextEnd = resolved.end;
    }
    const params = new URLSearchParams({
      projectId: nextProjectId,
      report,
      range: effectiveRange,
      start: nextStart,
      end: nextEnd
    });
    if (forceRefresh) {
      params.set("refresh", "1");
    } else if (refresh) {
      params.set("refresh", refresh);
    }
    void prefetchReports({
      projectId: nextProjectId,
      startDate: nextStart,
      endDate: nextEnd,
      force: forceRefresh
    });
    router.push(`${basePath}?${params.toString()}`);
  }

  function handleProjectChange(projectId: string) {
    applyFilters({ nextProjectId: projectId });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="text-sm text-slate/60">Select a project to view GA4 reports.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ProjectSelector
            projects={projects}
            value={selectedProjectId}
            onChange={handleProjectChange}
            persistKey="mdh:reports:selectedProjectId"
          />
          <select
            className="input max-w-[180px] min-w-[140px]"
            value={selectedRange}
            onChange={(event) => {
              const nextRange = event.target.value as RangeKey;
              setSelectedRange(nextRange);
              setError(null);
              if (nextRange !== "custom") {
                applyFilters({ rangeOverride: nextRange });
              }
            }}
          >
            {rangeOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
          {selectedRange === "custom" ? (
            <DateRangePicker
              start={customStart}
              end={customEnd}
              onChange={(next) => {
                setCustomStart(next.start);
                setCustomEnd(next.end);
                applyFilters({
                  rangeOverride: "custom",
                  customStartOverride: next.start,
                  customEndOverride: next.end
                });
              }}
            />
          ) : null}
        </div>
      </div>
      {error ? <div className="alert">{error}</div> : null}
    </div>
  );
}
