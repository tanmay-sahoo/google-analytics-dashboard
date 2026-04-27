import Sparkline from "@/components/Sparkline";

export type KPIDeltaTone = "up" | "down" | "flat";

export default function KPICard({
  label,
  value,
  helper,
  trend,
  delta,
  deltaTone = "flat",
  deltaHelper
}: {
  label: string;
  value: string | number;
  helper?: string;
  trend?: number[];
  delta?: string | null;
  deltaTone?: KPIDeltaTone;
  deltaHelper?: string;
}) {
  const sparkTone = deltaTone === "up" ? "positive" : deltaTone === "down" ? "negative" : "ocean";
  const deltaClass =
    deltaTone === "up"
      ? "text-emerald-600"
      : deltaTone === "down"
      ? "text-rose-600"
      : "text-slate/60";

  return (
    <div className="card">
      <div className="label">{label}</div>
      <div className="kpi mt-3">{value}</div>
      {delta ? (
        <div className={`mt-1 text-xs ${deltaClass}`}>
          {delta}
          {deltaHelper ? <span className="text-slate/50"> {deltaHelper}</span> : null}
        </div>
      ) : null}
      {trend && trend.length > 1 ? (
        <div className="mt-3">
          <Sparkline points={trend} tone={sparkTone} height={32} />
        </div>
      ) : null}
      {helper ? <div className="mt-2 text-xs text-slate/60">{helper}</div> : null}
    </div>
  );
}
