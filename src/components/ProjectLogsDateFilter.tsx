"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import DateRangePicker from "@/components/DateRangePicker";
import FlashMessage from "@/components/FlashMessage";
import { addDays, formatLocalDate } from "@/lib/time";
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

function resolveRangeDates(rangeKey: RangeKey) {
  const endDate = new Date();
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
    start: formatLocalDate(startDate),
    end: formatLocalDate(endDate)
  };
}

export default function ProjectLogsDateFilter({
  projectId,
  tab,
  range,
  start,
  end,
  urlHadRange = true,
  preferenceScope = "project-logs"
}: {
  projectId: string;
  tab: string;
  range: RangeKey;
  start: string;
  end: string;
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
    rangeKey,
    startDate,
    endDate
  }: {
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
      tab,
      range: rangeKey,
      start: startDate,
      end: endDate
    });
    router.push(`/projects/${projectId}?${params.toString()}`);
  }

  function apply({
    rangeKey = selectedRange,
    startDate = customStart,
    endDate = customEnd
  }: {
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
      pushFilters({ rangeKey, startDate, endDate });
      return;
    }
    const resolved = resolveRangeDates(rangeKey);
    pushFilters({ rangeKey, startDate: resolved.start, endDate: resolved.end });
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
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs uppercase tracking-[0.2em] text-slate/50">Date range</span>
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
              apply({ rangeKey: "custom", startDate: next.start, endDate: next.end });
            }}
          />
        ) : null}
      </div>
      <FlashMessage message={error} tone="error" onDismiss={() => setError(null)} />
    </div>
  );
}
