"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { formatCurrency } from "@/lib/format";

type Point = {
  date: string;
  spend: number;
  revenue: number;
};

function shortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const day = String(date.getDate()).padStart(2, "0");
  const month = date.toLocaleString("en-US", { month: "short" });
  return `${day} ${month}`;
}

function TrendTooltip({
  active,
  payload,
  label,
  currency
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ dataKey?: string; value?: number }>;
  label?: string;
  currency: string;
}) {
  if (!active || !payload?.length) return null;

  const spend = Number(payload.find((item) => item.dataKey === "spend")?.value ?? 0);
  const revenue = Number(payload.find((item) => item.dataKey === "revenue")?.value ?? 0);
  const roas = spend > 0 ? revenue / spend : 0;
  const delta = revenue - spend;
  const deltaPct = spend > 0 ? (delta / spend) * 100 : 0;
  const signal =
    spend <= 0 ? "No spend" : roas >= 1 ? `Above break-even (+${deltaPct.toFixed(1)}%)` : `Below break-even (${deltaPct.toFixed(1)}%)`;

  return (
    <div
      className="rounded-xl border px-3 py-2 text-xs shadow-sm"
      style={{
        backgroundColor: "var(--chart-tooltip-bg)",
        borderColor: "var(--chart-tooltip-border)",
        color: "var(--chart-text)"
      }}
    >
      <div className="mb-1 font-semibold">{shortDate(String(label ?? ""))}</div>
      <div className="flex items-center justify-between gap-3">
        <span>Spend</span>
        <span>{formatCurrency(spend, currency)}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span>Revenue</span>
        <span>{formatCurrency(revenue, currency)}</span>
      </div>
      <div className="mt-1 border-t border-slate/20 pt-1">
        <div className="flex items-center justify-between gap-3">
          <span>ROAS</span>
          <span>{roas.toFixed(2)}x</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Net</span>
          <span>{formatCurrency(delta, currency)}</span>
        </div>
        <div className="mt-1 text-[11px] text-slate/60">{signal}</div>
      </div>
    </div>
  );
}

export default function DualTrendChart({
  points,
  currency
}: {
  points: Point[];
  currency: string;
}) {
  const spendFillId = useId().replace(/:/g, "") + "-spend";
  const revenueFillId = useId().replace(/:/g, "") + "-revenue";

  if (!points.length) {
    return (
      <div className="card">
        <div className="label">Spend vs Revenue Trend</div>
        <div className="mt-6 flex h-56 items-center justify-center text-sm text-slate/50">
          No Ads trend data yet.
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="label">Spend vs Revenue Trend</div>
      <div className="mt-3 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 6, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={spendFillId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#2563eb" stopOpacity={0.03} />
              </linearGradient>
              <linearGradient id={revenueFillId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0f766e" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#0f766e" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--chart-text)", fontSize: 11 }}
              tickFormatter={shortDate}
              minTickGap={28}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--chart-text)", fontSize: 11 }}
              tickFormatter={(value: number) => formatCurrency(value, currency)}
              width={88}
            />
            <Tooltip
              cursor={{ stroke: "var(--chart-grid)", strokeWidth: 1 }}
              content={(props) => (
                <TrendTooltip
                  active={props.active}
                  payload={props.payload as ReadonlyArray<{ dataKey?: string; value?: number }>}
                  label={props.label as string}
                  currency={currency}
                />
              )}
            />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              wrapperStyle={{ fontSize: "12px", color: "var(--chart-text)" }}
            />
            <Area
              type="monotone"
              dataKey="spend"
              name="Spend"
              stroke="#2563eb"
              fill={`url(#${spendFillId})`}
              strokeWidth={2.4}
              activeDot={{ r: 4, strokeWidth: 2, fill: "#fff", stroke: "#2563eb" }}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              name="Revenue"
              stroke="#0f766e"
              fill={`url(#${revenueFillId})`}
              strokeWidth={2.4}
              activeDot={{ r: 4, strokeWidth: 2, fill: "#fff", stroke: "#0f766e" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
