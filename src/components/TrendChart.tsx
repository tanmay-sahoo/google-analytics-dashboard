export default function TrendChart({
  points,
  label
}: {
  points: number[];
  label: string;
}) {
  if (!points.length) {
    return (
      <div className="card">
        <div className="label">{label}</div>
        <div className="mt-6 flex h-20 items-center justify-center text-sm text-slate/50">
          No data yet.
        </div>
      </div>
    );
  }

  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const path = points
    .map((value, index) => {
      const x = (index / (points.length - 1)) * 100;
      const y = 100 - ((value - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="card">
      <div className="label">{label}</div>
      <svg viewBox="0 0 100 40" className="mt-3 h-20 w-full">
        <polyline
          fill="none"
          stroke="#1b6ca8"
          strokeWidth="2"
          points={path}
        />
      </svg>
    </div>
  );
}
