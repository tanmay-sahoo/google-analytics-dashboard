"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function toLocalIso(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIso(value: string) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map((part) => Number(part));
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(value: Date, months: number) {
  return new Date(value.getFullYear(), value.getMonth() + months, 1);
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function formatLabel(value: string) {
  const date = parseIso(value);
  if (!date) return "--";
  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function buildCalendarDays(monthDate: Date) {
  const monthStart = startOfMonth(monthDate);
  const gridStart = addDays(monthStart, -monthStart.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(gridStart, index);
    return {
      date,
      iso: toLocalIso(date),
      inMonth: date.getMonth() === monthStart.getMonth()
    };
  });
}

export default function DateRangePicker({
  start,
  end,
  max,
  min,
  onChange
}: {
  start: string;
  end: string;
  max?: string;
  min?: string;
  onChange: (next: { start: string; end: string }) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const selected = parseIso(end) ?? parseIso(start) ?? new Date();
    return startOfMonth(selected);
  });
  const [draftStart, setDraftStart] = useState(start);
  const [draftEnd, setDraftEnd] = useState(end);

  const minTs = min ? parseIso(min)?.getTime() ?? null : null;
  const maxTs = max ? parseIso(max)?.getTime() ?? null : null;
  const startTs = draftStart ? parseIso(draftStart)?.getTime() ?? null : null;
  const endTs = draftEnd ? parseIso(draftEnd)?.getTime() ?? null : null;

  useEffect(() => {
    if (!open) return;
    const selected = parseIso(end) ?? parseIso(start) ?? new Date();
    setViewMonth(startOfMonth(selected));
    setDraftStart(start);
    setDraftEnd(end);
  }, [open, start, end]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const months = useMemo(() => [viewMonth, addMonths(viewMonth, 1)], [viewMonth]);

  function handleDayClick(dayIso: string) {
    const dayTs = parseIso(dayIso)?.getTime();
    if (!dayTs) return;
    if (minTs !== null && dayTs < minTs) return;
    if (maxTs !== null && dayTs > maxTs) return;

    if (!draftStart || (draftStart && draftEnd)) {
      setDraftStart(dayIso);
      setDraftEnd("");
      return;
    }
    if (dayIso < draftStart) {
      setDraftStart(dayIso);
      setDraftEnd("");
      return;
    }
    setDraftEnd(dayIso);
  }

  function applySelection() {
    if (!draftStart || !draftEnd) return;
    onChange({ start: draftStart, end: draftEnd });
    setOpen(false);
  }

  function clearSelection() {
    setDraftStart("");
    setDraftEnd("");
  }

  const triggerLabel =
    start && end ? `${formatLabel(start)} - ${formatLabel(end)}` : "Select date range";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="input flex min-w-[270px] items-center justify-between gap-3 text-left"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="truncate">{triggerLabel}</span>
        <CalendarDays className="h-4 w-4 text-slate/50" />
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(92vw,720px)] rounded-2xl border border-slate/20 bg-white p-4 shadow-xl">
          <div className="flex items-center justify-between">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate/20 bg-white text-slate transition hover:bg-slate/5"
              onClick={() => setViewMonth((month) => addMonths(month, -1))}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4 stroke-[2.4]" />
            </button>
            <div className="text-sm text-slate/60">
              {draftStart && draftEnd
                ? `${formatLabel(draftStart)} - ${formatLabel(draftEnd)}`
                : draftStart
                  ? `${formatLabel(draftStart)} - Select end`
                  : "Select start and end dates"}
            </div>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate/20 bg-white text-slate transition hover:bg-slate/5"
              onClick={() => setViewMonth((month) => addMonths(month, 1))}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4 stroke-[2.4]" />
            </button>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {months.map((monthDate) => {
              const days = buildCalendarDays(monthDate);
              return (
                <div key={`${monthDate.getFullYear()}-${monthDate.getMonth()}`}>
                  <div className="mb-2 text-sm font-semibold text-slate">
                    {monthDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {WEEKDAY_LABELS.map((weekday) => (
                      <div
                        key={weekday}
                        className="py-1 text-center text-[11px] font-medium uppercase tracking-[0.08em] text-slate/50"
                      >
                        {weekday}
                      </div>
                    ))}
                    {days.map((day) => {
                      const dayTs = day.date.getTime();
                      const disabled =
                        (minTs !== null && dayTs < minTs) || (maxTs !== null && dayTs > maxTs);
                      const selectedStart = startTs !== null && dayTs === startTs;
                      const selectedEnd = endTs !== null && dayTs === endTs;
                      const inRange =
                        startTs !== null && endTs !== null && dayTs > startTs && dayTs < endTs;
                      const today = isSameDay(day.date, new Date());

                      return (
                        <button
                          key={day.iso}
                          type="button"
                          disabled={disabled}
                          onClick={() => handleDayClick(day.iso)}
                          className={`h-9 rounded-lg text-sm transition ${
                            selectedStart || selectedEnd
                              ? "bg-ocean text-white"
                              : inRange
                                ? "bg-ocean/15 text-slate"
                                : day.inMonth
                                  ? "text-slate hover:bg-slate/5"
                                  : "text-slate/30 hover:bg-slate/5"
                          } ${today && !(selectedStart || selectedEnd) ? "ring-1 ring-ocean/60" : ""} ${
                            disabled ? "cursor-not-allowed opacity-35" : ""
                          }`}
                        >
                          {day.date.getDate()}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate/10 pt-4">
            <button type="button" className="btn-outline" onClick={clearSelection}>
              Clear
            </button>
            <div className="flex items-center gap-2">
              <button type="button" className="btn-outline" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={!draftStart || !draftEnd}
                onClick={applySelection}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
