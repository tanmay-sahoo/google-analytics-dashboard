"use client";

import { useMemo, useState } from "react";
import ProjectSelector from "@/components/ProjectSelector";
import { formatCurrency, formatNumber } from "@/lib/format";

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

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
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
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (!points.length) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-slate/50">
        No GA4 trend data yet.
      </div>
    );
  }

  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const chartTop = 8;
  const chartBottom = 86;
  const chartHeight = chartBottom - chartTop;
  const mapped = points.map((value, index) => {
    const x = (index / Math.max(points.length - 1, 1)) * 100;
    const y = chartTop + (1 - (value - min) / range) * chartHeight;
    return { x, y };
  });
  const line = mapped.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPath = `M 0,${chartBottom} ${line} 100,${chartBottom}`;
  const maxIndex = points.indexOf(max);
  const yTicks = [max, min + range / 2, min];
  const hover = hoverIndex !== null ? mapped[hoverIndex] : null;
  const hoverValue = hoverIndex !== null ? points[hoverIndex] : null;
  const hoverDate = hoverIndex !== null ? dates[hoverIndex] : null;

  return (
    <div className="relative">
      <svg
        viewBox="0 0 100 100"
        className="h-48 w-full sm:h-56 lg:h-64"
        onMouseMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          const ratio = (event.clientX - bounds.left) / Math.max(bounds.width, 1);
          const index = Math.min(
            points.length - 1,
            Math.max(0, Math.round(ratio * (points.length - 1)))
          );
          setHoverIndex(index);
        }}
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#2b64f2" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#2b64f2" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g stroke="#e6e9f0" strokeWidth="0.4">
          <line x1="0" y1={chartTop} x2="100" y2={chartTop} />
          <line x1="0" y1={chartTop + chartHeight / 2} x2="100" y2={chartTop + chartHeight / 2} />
          <line x1="0" y1={chartBottom} x2="100" y2={chartBottom} />
        </g>
        <path d={areaPath} fill="url(#trendFill)" stroke="none" />
        <polyline
          fill="none"
          stroke="#2b64f2"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={line}
        />
        {hover ? (
          <>
            <line
              x1={hover.x}
              x2={hover.x}
              y1={chartTop}
              y2={chartBottom}
              stroke="#d8deea"
              strokeWidth="0.6"
            />
            <circle
              cx={hover.x}
              cy={hover.y}
              r="2.2"
              fill="#ffffff"
              stroke="#2b64f2"
              strokeWidth="1.2"
            />
          </>
        ) : null}
        {maxIndex >= 0 ? (
          <circle
            cx={mapped[maxIndex]?.x ?? 0}
            cy={mapped[maxIndex]?.y ?? 0}
            r="2.2"
            fill="#ffffff"
            stroke="#2b64f2"
            strokeWidth="1.2"
          />
        ) : null}
      </svg>

      <div className="pointer-events-none absolute inset-y-6 right-0 flex flex-col items-end justify-between text-[10px] text-slate/50">
        {yTicks.map((value, index) => (
          <span key={index}>{formatValue(value)}</span>
        ))}
      </div>

      <div className="absolute inset-x-0 bottom-2 flex items-center justify-between text-[10px] text-slate/50">
        <span>{formatShortDateLabel(dates[0] ?? "")}</span>
        <span>{formatShortDateLabel(dates[Math.floor(dates.length / 2)] ?? "")}</span>
        <span>{formatShortDateLabel(dates[dates.length - 1] ?? "")}</span>
      </div>

      {hover && hoverValue !== null ? (
        <div
          className="pointer-events-none absolute rounded-xl border border-slate/10 bg-white px-3 py-2 text-xs text-slate shadow-sm"
          style={{
            left: `${hover.x}%`,
            top: `${hover.y}%`,
            transform: "translate(-50%, -120%)"
          }}
        >
          <div className="text-slate/50">{formatShortDateLabel(hoverDate ?? "")}</div>
          <div className="text-sm font-semibold">{formatValue(hoverValue)}</div>
        </div>
      ) : null}
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

  const applyRange = async (projectIdOverride?: string) => {
    const projectId = projectIdOverride ?? selectedProjectId;
    if (!projectId) return;
    setStatus("loading");
    setFilterError(null);
    let start = "";
    let end = "";
    if (range === "custom") {
      start = customStart;
      end = customEnd;
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
      const resolved = resolveRange(range);
      start = resolved.start;
      end = resolved.end;
    }
    const params = new URLSearchParams({
      projectId,
      start,
      end,
      compare: compare ? "previous" : ""
    });
    if (!compare) {
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
    await applyRange(projectId);
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

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="page-title">Home</h1>
          <p className="muted">GA4 performance snapshot across the last 30 days.</p>
          {status === "loading" && <p className="mt-2 text-xs text-slate/50">Loading data...</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {projects.length ? (
            <ProjectSelector projects={projects} value={selectedProjectId} onChange={handleChange} />
          ) : null}
          <select
            className="input max-w-[180px] min-w-[140px]"
            value={range}
            onChange={(event) => setRange(event.target.value as RangeKey)}
          >
            {rangeOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
          {range === "custom" ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                className="input max-w-[160px] min-w-[140px]"
                value={customStart}
                max={customEnd || todayDate()}
                onChange={(event) => setCustomStart(event.target.value)}
              />
              <span className="text-xs text-slate/50">to</span>
              <input
                type="date"
                className="input max-w-[160px] min-w-[140px]"
                value={customEnd}
                min={customStart || undefined}
                max={todayDate()}
                onChange={(event) => setCustomEnd(event.target.value)}
              />
            </div>
          ) : null}
          <label className="flex items-center gap-2 text-sm text-slate/60">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border border-slate/20"
              checked={compare}
              onChange={(event) => setCompare(event.target.checked)}
            />
            Compare to previous
          </label>
          <button type="button" className="btn-primary w-full sm:w-auto" onClick={() => void applyRange()}>
            Apply
          </button>
        </div>
      </div>

      {filterError ? <div className="alert">{filterError}</div> : null}
      {status === "error" && (
        <div className="alert">Failed to load dashboard data. Try again.</div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="card space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {metricOptions.map((metric) => {
              const isActive = metric.key === activeMetric;
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
                <span className="text-left">
                  <span className="block text-xs uppercase tracking-[0.2em] text-slate/60">
                    {metric.label}
                  </span>
                  <span className="block text-lg font-semibold text-slate">
                    {kpiValues[metric.key]}
                  </span>
                  {compare && deltaLabels[metric.key] ? (
                    <span className="mt-1 block text-xs text-slate/50">
                      {deltaLabels[metric.key]} vs previous
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
  );
}
