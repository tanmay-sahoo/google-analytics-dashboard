"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ProjectSelector from "@/components/ProjectSelector";
import DateRangePicker from "@/components/DateRangePicker";
import FlashMessage from "@/components/FlashMessage";
import { addDays, formatDateShort } from "@/lib/time";
import {
  readDateRangePreference,
  saveDateRangePreference
} from "@/lib/date-range-preference";

const rangeOptions = [
  { key: "last7", label: "Last 7 days" },
  { key: "last30", label: "Last 30 days" },
  { key: "last90", label: "Last 90 days" },
  { key: "month", label: "This month" },
  { key: "custom", label: "Custom range" }
] as const;

type RangeKey = (typeof rangeOptions)[number]["key"];

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

export default function AdsIntelligenceFilters({
  projects,
  selectedProjectId,
  range,
  start,
  end,
  basePath = "/ads",
  urlHadRange = true,
  preferenceScope = "ads"
}: {
  projects: { id: string; name: string }[];
  selectedProjectId: string;
  range: RangeKey;
  start: string;
  end: string;
  basePath?: string;
  urlHadRange?: boolean;
  preferenceScope?: string;
}) {
  const router = useRouter();
  const [selectedRange, setSelectedRange] = useState<RangeKey>(range);
  const [customStart, setCustomStart] = useState(start);
  const [customEnd, setCustomEnd] = useState(end);
  const [error, setError] = useState<string | null>(null);
  const restoredPreferenceRef = useRef(false);

  function pushFilters({
    projectId,
    rangeKey,
    startDate,
    endDate
  }: {
    projectId: string;
    rangeKey: RangeKey;
    startDate: string;
    endDate: string;
  }) {
    saveDateRangePreference(preferenceScope, {
      range: rangeKey,
      start: rangeKey === "custom" ? startDate : undefined,
      end: rangeKey === "custom" ? endDate : undefined
    });
    const params = new URLSearchParams({
      projectId,
      range: rangeKey,
      start: startDate,
      end: endDate
    });
    router.push(`${basePath}?${params.toString()}`);
  }

  function apply({
    projectId = selectedProjectId,
    rangeKey = selectedRange,
    startDate = customStart,
    endDate = customEnd
  }: {
    projectId?: string;
    rangeKey?: RangeKey;
    startDate?: string;
    endDate?: string;
  } = {}) {
    setError(null);
    if (rangeKey === "custom") {
      if (!startDate || !endDate) {
        setError("Select both start and end dates.");
        return;
      }
      if (new Date(startDate) > new Date(endDate)) {
        setError("Start date must be before end date.");
        return;
      }
      pushFilters({ projectId, rangeKey, startDate, endDate });
      return;
    }

    const resolved = resolveRangeDates(rangeKey, end);
    pushFilters({
      projectId,
      rangeKey,
      startDate: resolved.start,
      endDate: resolved.end
    });
  }

  useEffect(() => {
    if (restoredPreferenceRef.current) return;
    restoredPreferenceRef.current = true;
    if (urlHadRange) return;
    const saved = readDateRangePreference(preferenceScope);
    if (!saved) return;
    if (saved.range === "custom" && saved.start && saved.end) {
      setSelectedRange("custom");
      setCustomStart(saved.start);
      setCustomEnd(saved.end);
      apply({ rangeKey: "custom", startDate: saved.start, endDate: saved.end });
      return;
    }
    if (saved.range !== range) {
      setSelectedRange(saved.range);
      apply({ rangeKey: saved.range });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="page-title">Ads Intelligence</h1>
          <p className="muted">
            Track CPC, CPM, CTR, CPA, CAC, product spend vs revenue, geo performance, and keyword waste.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ProjectSelector
            projects={projects}
            value={selectedProjectId}
            onChange={(projectId) => apply({ projectId })}
            persistKey="mdh:ads:selectedProjectId"
          />
          <select
            className="input max-w-[180px] min-w-[140px]"
            value={selectedRange}
            onChange={(event) => {
              const nextRange = event.target.value as RangeKey;
              setSelectedRange(nextRange);
              if (nextRange !== "custom") apply({ rangeKey: nextRange });
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
                apply({
                  rangeKey: "custom",
                  startDate: next.start,
                  endDate: next.end
                });
              }}
            />
          ) : null}
        </div>
      </div>
      <FlashMessage message={error} tone="error" onDismiss={() => setError(null)} />
    </div>
  );
}
