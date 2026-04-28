"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import ProjectSelector from "@/components/ProjectSelector";
import DateRangePicker from "@/components/DateRangePicker";
import Sparkline from "@/components/Sparkline";
import DashboardSkeleton from "@/components/DashboardSkeleton";
import { formatCurrency, formatNumber } from "@/lib/format";
import {
  readDateRangePreference,
  saveDateRangePreference
} from "@/lib/date-range-preference";
import FlashMessage from "@/components/FlashMessage";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

type DashboardPayload = {
  currency: string;
  kpis: { users: number; sessions: number; conversions: number; revenue: number };
  trend: {
    dates: string[];
    users: number[];
    sessions: number[];
    conversions: number[];
    revenue: number[];
  };
  realtime: { activeUsers: number; countries: { label: string; value: number }[] };
  highlights: {
    events: { label: string; value: number }[];
    sources: { label: string; value: number }[];
    landingPages: { label: string; value: number }[];
    userAcquisition: { label: string; value: number }[];
    sessionAcquisition: { label: string; value: number }[];
    countries: { label: string; value: number }[];
  };
  compare: null | {
    range: { start: string; end: string };
    kpis: { users: number; sessions: number; conversions: number; revenue: number };
    deltas: { users: number | null; sessions: number | null; conversions: number | null; revenue: number | null };
  };
};

const metricOptions = [
  { key: "sessions", label: "Sessions" },
  { key: "users", label: "Users" },
  { key: "conversions", label: "Conversions" },
  { key: "revenue", label: "Revenue" }
] as const;

type MetricKey = (typeof metricOptions)[number]["key"];

const rangeOptions = [
  { key: "last7", label: "Last 7 days" },
  { key: "last30", label: "Last 30 days" },
  { key: "last90", label: "Last 90 days" },
  { key: "month", label: "This month" },
  { key: "custom", label: "Custom range" }
] as const;

type RangeKey = (typeof rangeOptions)[number]["key"];

function formatDelta(value: number | null) {
  if (value === null || Number.isNaN(value)) return null;
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function deltaTone(value: number | null): "up" | "down" | "flat" {
  if (value === null || Number.isNaN(value) || value === 0) return "flat";
  return value > 0 ? "up" : "down";
}

function formatDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function resolveRange(range: RangeKey) {
  const end = new Date();
  let start = new Date();
  if (range === "last7") {
    start.setDate(end.getDate() - 6);
  } else if (range === "last30") {
    start.setDate(end.getDate() - 29);
  } else if (range === "last90") {
    start.setDate(end.getDate() - 89);
  } else {
    start = new Date(end.getFullYear(), end.getMonth(), 1);
  }
  return { start: formatDate(start), end: formatDate(end) };
}

function getRangeLabel(dates: string[]) {
  if (!dates.length) return "--";
  const sorted = [...dates].sort();
  return `${sorted[0]} - ${sorted[sorted.length - 1]}`;
}

function todayDate() {
  return formatDate(new Date());
}

function BarList({
  title,
  metricLabel,
  items
}: {
  title: string;
  metricLabel: string;
  items: { label: string; value: number }[];
}) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <p className="label">{title}</p>
        <span className="text-xs text-slate/50">{metricLabel}</span>
      </div>
      <div className="mt-4 space-y-3">
        {items.length ? (
          items.map((item) => (
            <div key={item.label} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="truncate pr-2">{item.label}</span>
                <span className="text-slate/60">{formatNumber(item.value)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate/10">
                <div
                  className="h-1.5 rounded-full bg-ocean"
                  style={{ width: `${Math.min(100, (item.value / max) * 100)}%` }}
                />
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate/50">No data yet.</p>
        )}
      </div>
    </div>
  );
}

function formatShortDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = String(date.getDate()).padStart(2, "0");
  const month = monthNames[date.getMonth()] ?? "";
  return `${day} ${month}`;
}

function TrendArea({
  points,
  dates,
  formatValue
}: {
  points: number[];
  dates: string[];
  formatValue: (value: number) => string;
}) {
  const gradientId = useId().replace(/:/g, "");
  const chartData = useMemo(
    () =>
      points.map((value, index) => ({
        value,
        date: dates[index] ?? "",
        shortDate: formatShortDateLabel(dates[index] ?? "")
      })),
    [points, dates]
  );

  if (!chartData.length) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-slate/50">
        No GA4 trend data yet.
      </div>
    );
  }

  return (
    <div className="h-56 w-full sm:h-64 lg:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 2, bottom: 4 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-line)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--chart-line)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 4" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatShortDateLabel}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--chart-text)", fontSize: 11 }}
            minTickGap={24}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--chart-text)", fontSize: 11 }}
            width={72}
            tickFormatter={(value: number) => formatValue(value)}
          />
          <Tooltip
            cursor={{ stroke: "var(--chart-grid)", strokeWidth: 1 }}
            contentStyle={{
              backgroundColor: "var(--chart-tooltip-bg)",
              borderColor: "var(--chart-tooltip-border)",
              borderRadius: "12px",
              boxShadow: "0 8px 24px rgba(15, 23, 42, 0.12)"
            }}
            labelFormatter={(label) => formatShortDateLabel(String(label))}
            formatter={(value) => [formatValue(Number(value ?? 0)), "Value"]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--chart-line)"
            strokeWidth={2.8}
            fill={`url(#${gradientId})`}
            activeDot={{ r: 5, strokeWidth: 2, fill: "#fff", stroke: "var(--chart-line)" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function DashboardClient({
  projects,
  initialDashboard
}: {
  projects: { id: string; name: string }[];
  initialDashboard: DashboardPayload | null;
}) {
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(initialDashboard);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [activeMetric, setActiveMetric] = useState<MetricKey>("sessions");
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id ?? "");
  const [range, setRange] = useState<RangeKey>("last30");
  const [compare, setCompare] = useState(false);
  const initialRange = resolveRange("last30");
  const [customStart, setCustomStart] = useState(initialRange.start);
  const [customEnd, setCustomEnd] = useState(initialRange.end);
  const [filterError, setFilterError] = useState<string | null>(null);
  const restoredPreferenceRef = useRef(false);

  useEffect(() => {
    if (restoredPreferenceRef.current) return;
    restoredPreferenceRef.current = true;
    const saved = readDateRangePreference("dashboard");
    if (!saved) return;
    setRange(saved.range);
    if (saved.range === "custom" && saved.start && saved.end) {
      setCustomStart(saved.start);
      setCustomEnd(saved.end);
      void applyRange({
        rangeOverride: "custom",
        customStartOverride: saved.start,
        customEndOverride: saved.end
      });
    } else if (saved.range !== "last30") {
      void applyRange({ rangeOverride: saved.range });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyRange = async ({
    projectIdOverride,
    rangeOverride,
    customStartOverride,
    customEndOverride,
    compareOverride
  }: {
    projectIdOverride?: string;
    rangeOverride?: RangeKey;
    customStartOverride?: string;
    customEndOverride?: string;
    compareOverride?: boolean;
  } = {}) => {
    const projectId = projectIdOverride ?? selectedProjectId;
    const effectiveRange = rangeOverride ?? range;
    const effectiveCustomStart = customStartOverride ?? customStart;
    const effectiveCustomEnd = customEndOverride ?? customEnd;
    const effectiveCompare = compareOverride ?? compare;
    if (!projectId) return;
    setStatus("loading");
    setFilterError(null);
    let start = "";
    let end = "";
    if (effectiveRange === "custom") {
      start = effectiveCustomStart;
      end = effectiveCustomEnd;
      if (!start || !end) {
        setFilterError("Select both start and end dates.");
        setStatus("idle");
        return;
      }
      if (new Date(start) > new Date(end)) {
        setFilterError("Start date must be before end date.");
        setStatus("idle");
        return;
      }
    } else {
      const resolved = resolveRange(effectiveRange);
      start = resolved.start;
      end = resolved.end;
    }
    saveDateRangePreference("dashboard", {
      range: effectiveRange,
      start: effectiveRange === "custom" ? start : undefined,
      end: effectiveRange === "custom" ? end : undefined
    });
    const params = new URLSearchParams({
      projectId,
      start,
      end,
      compare: effectiveCompare ? "previous" : ""
    });
    if (!effectiveCompare) {
      params.delete("compare");
    }
    const response = await fetch(`/api/metrics/dashboard?${params.toString()}`);
    if (response.ok) {
      const data = await response.json();
      setDashboard(data);
      setStatus("idle");
      return;
    }
    setStatus("error");
  };

  async function handleChange(projectId: string) {
    setSelectedProjectId(projectId);
    await applyRange({ projectIdOverride: projectId });
  }

  const currency = dashboard?.currency ?? "INR";
  const trendPoints = useMemo(() => {
    if (!dashboard) return [];
    if (activeMetric === "users") return dashboard.trend.users;
    if (activeMetric === "conversions") return dashboard.trend.conversions;
    if (activeMetric === "revenue") return dashboard.trend.revenue;
    return dashboard.trend.sessions;
  }, [dashboard, activeMetric]);
  const trendDates = dashboard?.trend.dates ?? [];
  const formatTrendValue =
    activeMetric === "revenue"
      ? (value: number) => formatCurrency(value, currency)
      : (value: number) => formatNumber(Math.round(value));
  const rangeLabel = dashboard ? getRangeLabel(dashboard.trend.dates) : "--";
  const rangeText = rangeOptions.find((option) => option.key === range)?.label ?? "Last 30 days";

  const revenueValue = formatCurrency(dashboard?.kpis.revenue ?? 0, currency);
  const kpiValues = {
    sessions: formatNumber(dashboard?.kpis.sessions ?? 0),
    users: formatNumber(dashboard?.kpis.users ?? 0),
    conversions: formatNumber(dashboard?.kpis.conversions ?? 0),
    revenue: revenueValue
  };
  const deltaValues = dashboard?.compare?.deltas ?? null;
  const deltaLabels: Record<MetricKey, string | null> = {
    sessions: formatDelta(deltaValues?.sessions ?? null),
    users: formatDelta(deltaValues?.users ?? null),
    conversions: formatDelta(deltaValues?.conversions ?? null),
    revenue: formatDelta(deltaValues?.revenue ?? null)
  };
  const trendByMetric: Record<MetricKey, number[]> = {
    sessions: dashboard?.trend.sessions ?? [],
    users: dashboard?.trend.users ?? [],
    conversions: dashboard?.trend.conversions ?? [],
    revenue: dashboard?.trend.revenue ?? []
  };
  const deltaToneByMetric: Record<MetricKey, "up" | "down" | "flat"> = {
    sessions: deltaTone(deltaValues?.sessions ?? null),
    users: deltaTone(deltaValues?.users ?? null),
    conversions: deltaTone(deltaValues?.conversions ?? null),
    revenue: deltaTone(deltaValues?.revenue ?? null)
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="page-title">Home</h1>
          <p className="muted">GA4 performance snapshot across the last 30 days.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {projects.length ? (
            <ProjectSelector
              projects={projects}
              value={selectedProjectId}
              onChange={handleChange}
              persistKey="mdh:dashboard:selectedProjectId"
            />
          ) : null}
          <select
            className="input max-w-[180px] min-w-[140px]"
            value={range}
            onChange={(event) => {
              const nextRange = event.target.value as RangeKey;
              setRange(nextRange);
              setFilterError(null);
              if (nextRange !== "custom") {
                void applyRange({ rangeOverride: nextRange });
              }
            }}
          >
            {rangeOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
          {range === "custom" ? (
            <DateRangePicker
              start={customStart}
              end={customEnd}
              max={todayDate()}
              onChange={(next) => {
                setCustomStart(next.start);
                setCustomEnd(next.end);
                void applyRange({
                  rangeOverride: "custom",
                  customStartOverride: next.start,
                  customEndOverride: next.end
                });
              }}
            />
          ) : null}
          <label className="flex items-center gap-2 text-sm text-slate/60">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border border-slate/20"
              checked={compare}
              onChange={(event) => {
                const nextCompare = event.target.checked;
                setCompare(nextCompare);
                void applyRange({ compareOverride: nextCompare });
              }}
            />
            Compare to previous
          </label>
        </div>
      </div>

      <FlashMessage message={filterError} tone="error" onDismiss={() => setFilterError(null)} />
      <FlashMessage
        message={status === "error" ? "Failed to load dashboard data. Try again." : null}
        tone="error"
      />

      {status === "loading" ? (
        <div aria-busy="true" aria-live="polite">
          <DashboardSkeleton />
        </div>
      ) : (
      <div className="space-y-8">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="card space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {metricOptions.map((metric) => {
              const isActive = metric.key === activeMetric;
              const tone = deltaToneByMetric[metric.key];
              const trendSeries = trendByMetric[metric.key];
              const deltaText = deltaLabels[metric.key];
              const deltaClass =
                tone === "up"
                  ? "text-emerald-600"
                  : tone === "down"
                  ? "text-rose-600"
                  : "text-slate/60";
              const sparkTone = tone === "up" ? "positive" : tone === "down" ? "negative" : "ocean";
              return (
              <button
                key={metric.key}
                type="button"
                className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                  isActive
                    ? "border-ocean bg-white shadow-sm"
                    : "border-slate/20 bg-white/80 hover:border-slate/40"
                }`}
                onClick={() => setActiveMetric(metric.key)}
              >
                <span className="block">
                  <span className="block text-xs uppercase tracking-[0.2em] text-slate/60">
                    {metric.label}
                  </span>
                  <span className="block text-lg font-semibold text-slate">
                    {kpiValues[metric.key]}
                  </span>
                  {compare && deltaText ? (
                    <span className={`mt-1 block text-xs ${deltaClass}`}>
                      {deltaText} <span className="text-slate/50">vs previous</span>
                    </span>
                  ) : null}
                  {trendSeries.length > 1 ? (
                    <span className="mt-2 block">
                      <Sparkline points={trendSeries} tone={sparkTone} height={28} />
                    </span>
                  ) : null}
                </span>
              </button>
              );
            })}
          </div>

          <div className="rounded-2xl border border-slate/10 bg-white/80 p-4">
            {trendPoints.length > 0 ? (
            <TrendArea points={trendPoints} dates={trendDates} formatValue={formatTrendValue} />
            ) : (
              <div className="flex h-48 items-center justify-center text-sm text-slate/50">
                No GA4 trend data yet.
              </div>
            )}
            <div className="mt-3 flex items-center justify-between text-xs text-slate/50">
              <span>{rangeText}</span>
              <span>{rangeLabel}</span>
            </div>
          </div>
        </div>

        <div className="card space-y-4">
          <div>
            <p className="label">Active users in last 30 minutes</p>
            <p className="mt-2 text-4xl font-semibold">
              {formatNumber(dashboard?.realtime.activeUsers ?? 0)}
            </p>
          </div>
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate/50">Top countries</p>
            {dashboard?.realtime.countries.length ? (
              dashboard.realtime.countries.map((item) => (
                <div key={item.label} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{item.label}</span>
                    <span className="text-slate/60">{formatNumber(item.value)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate/10">
                    <div
                      className="h-1.5 rounded-full bg-ocean"
                      style={{
                        width: `${Math.min(
                          100,
                          (item.value / Math.max(dashboard.realtime.activeUsers, 1)) * 100
                        )}%`
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate/50">No realtime activity yet.</p>
            )}
          </div>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="card">
          <div className="flex items-center justify-between">
            <p className="label">Top events</p>
            <span className="text-xs text-slate/50">Event count</span>
          </div>
          <div className="mt-4 space-y-3">
            {dashboard?.highlights.events.length ? (
              dashboard.highlights.events.map((item) => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <span className="truncate pr-2">{item.label}</span>
                  <span className="text-slate/60">{formatNumber(item.value)}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate/50">No events yet.</p>
            )}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <p className="label">Traffic acquisition</p>
            <span className="text-xs text-slate/50">Sessions</span>
          </div>
          <div className="mt-4 space-y-3">
            {dashboard?.highlights.sources.length ? (
              dashboard.highlights.sources.map((item) => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <span className="truncate pr-2">{item.label}</span>
                  <span className="text-slate/60">{formatNumber(item.value)}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate/50">No traffic data yet.</p>
            )}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <p className="label">Landing pages</p>
            <span className="text-xs text-slate/50">Views</span>
          </div>
          <div className="mt-4 space-y-3">
            {dashboard?.highlights.landingPages.length ? (
              dashboard.highlights.landingPages.map((item) => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <span className="truncate pr-2">{item.label}</span>
                  <span className="text-slate/60">{formatNumber(item.value)}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate/50">No landing page data yet.</p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <BarList
          title="New users by channel"
          metricLabel="New users"
          items={dashboard?.highlights.userAcquisition ?? []}
        />
        <BarList
          title="Sessions by channel"
          metricLabel="Sessions"
          items={dashboard?.highlights.sessionAcquisition ?? []}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <BarList
          title="Active users by country"
          metricLabel="Active users"
          items={dashboard?.highlights.countries ?? []}
        />
        <BarList
          title="Traffic acquisition"
          metricLabel="Sessions"
          items={dashboard?.highlights.sources ?? []}
        />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate/50">
            Recently accessed
          </h2>
          <span className="text-xs text-slate/50">{projects.length} projects</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {projects.slice(0, 4).map((project) => (
            <div key={project.id} className="card">
              <p className="text-sm text-slate/60">GA4 property</p>
              <p className="mt-2 text-lg font-semibold">{project.name}</p>
              <p className="mt-3 text-xs text-slate/50">Last 7 days</p>
            </div>
          ))}
        </div>
      </section>
      </div>
      )}
    </div>
  );
}
