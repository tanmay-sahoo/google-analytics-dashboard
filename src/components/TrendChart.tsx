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

export default function TrendChart({
  points,
  label
}: {
  points: number[];
  label: string;
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

  const chartData = points.map((value, index) => ({
    label: `P${index + 1}`,
    value
  }));

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
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--chart-text)", fontSize: 11 }}
              interval="preserveStartEnd"
              minTickGap={30}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--chart-text)", fontSize: 11 }}
              width={36}
            />
            <Tooltip
              cursor={{ stroke: "var(--chart-grid)", strokeWidth: 1 }}
              contentStyle={{
                backgroundColor: "var(--chart-tooltip-bg)",
                borderColor: "var(--chart-tooltip-border)",
                borderRadius: "12px"
              }}
              labelStyle={{ color: "var(--chart-text)", fontSize: 12 }}
              formatter={(value) => [Number(value ?? 0).toLocaleString(), "Value"]}
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
