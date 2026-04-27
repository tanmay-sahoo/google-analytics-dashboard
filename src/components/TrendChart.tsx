"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const day = String(date.getDate()).padStart(2, "0");
  const month = MONTHS[date.getMonth()] ?? "";
  return `${day} ${month}`;
}

export default function TrendChart({
  points,
  label,
  dates,
  formatValue
}: {
  points: number[];
  label: string;
  dates?: string[];
  formatValue?: (value: number) => string;
}) {
  const fillId = useId().replace(/:/g, "");

  if (!points.length) {
    return (
      <div className="card">
        <div className="label">{label}</div>
        <div className="mt-6 flex h-40 items-center justify-center text-sm text-slate/50">
          No data yet.
        </div>
      </div>
    );
  }

  const hasDates = Array.isArray(dates) && dates.length === points.length;
  const chartData = points.map((value, index) => ({
    label: hasDates ? dates![index] : `P${index + 1}`,
    value
  }));
  const formatXTick = hasDates ? (raw: string) => formatShortDate(raw) : (raw: string) => raw;
  const formatY = formatValue ?? ((value: number) => Number(value ?? 0).toLocaleString());

  return (
    <div className="card">
      <div className="label">{label}</div>
      <div className="mt-3 h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-line)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--chart-line)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tickFormatter={formatXTick}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--chart-text)", fontSize: 11 }}
              interval="preserveStartEnd"
              minTickGap={hasDates ? 24 : 30}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--chart-text)", fontSize: 11 }}
              width={48}
              tickFormatter={(value: number) => formatY(value)}
            />
            <Tooltip
              cursor={{ stroke: "var(--chart-grid)", strokeWidth: 1 }}
              contentStyle={{
                backgroundColor: "var(--chart-tooltip-bg)",
                borderColor: "var(--chart-tooltip-border)",
                borderRadius: "12px"
              }}
              labelStyle={{ color: "var(--chart-text)", fontSize: 12 }}
              labelFormatter={(raw) => (hasDates ? formatShortDate(String(raw)) : String(raw))}
              formatter={(value) => [formatY(Number(value ?? 0)), "Value"]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--chart-line)"
              strokeWidth={2.2}
              fill={`url(#${fillId})`}
              activeDot={{ r: 4, strokeWidth: 2, fill: "#fff", stroke: "var(--chart-line)" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
