export default function KPICard({
  label,
  value,
  helper
}: {
  label: string;
  value: string | number;
  helper?: string;
}) {
  return (
    <div className="card">
      <div className="label">{label}</div>
      <div className="kpi mt-3">{value}</div>
      {helper ? <div className="mt-2 text-xs text-slate/60">{helper}</div> : null}
    </div>
  );
}
