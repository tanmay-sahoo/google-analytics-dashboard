"use client";

import { useId, useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

export default function Sparkline({
  points,
  height = 36,
  tone = "ocean"
}: {
  points: number[];
  height?: number;
  tone?: "ocean" | "positive" | "negative" | "muted";
}) {
  const id = useId().replace(/:/g, "");

  const data = useMemo(() => points.map((value, index) => ({ index, value })), [points]);

  const stroke =
    tone === "positive"
      ? "var(--chart-positive, #16a34a)"
      : tone === "negative"
      ? "var(--chart-negative, #dc2626)"
      : tone === "muted"
      ? "var(--chart-text, #94a3b8)"
      : "var(--chart-line)";

  if (data.length < 2) {
    return <div style={{ height }} aria-hidden />;
  }

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.3} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={stroke}
            strokeWidth={1.6}
            fill={`url(#${id})`}
            isAnimationActive={false}
            dot={false}
            activeDot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
