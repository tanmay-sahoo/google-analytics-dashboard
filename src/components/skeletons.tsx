import Skeleton from "@/components/Skeleton";

export function PageHeaderSkeleton({ withControls = true }: { withControls?: boolean }) {
  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <div className="space-y-2">
        <Skeleton width={180} height={28} rounded="lg" />
        <Skeleton width={260} height={14} />
      </div>
      {withControls ? (
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton width={180} height={36} rounded="xl" />
          <Skeleton width={140} height={36} rounded="xl" />
          <Skeleton width={120} height={36} rounded="xl" />
        </div>
      ) : null}
    </div>
  );
}

export function KPICardSkeleton({ withSpark = true }: { withSpark?: boolean }) {
  return (
    <div className="card space-y-3">
      <Skeleton width={90} height={10} />
      <Skeleton width={120} height={26} rounded="lg" />
      {withSpark ? <Skeleton height={32} rounded="md" /> : null}
    </div>
  );
}

export function KPIGridSkeleton({
  count = 4,
  columnsClass = "grid gap-4 md:grid-cols-2 xl:grid-cols-4",
  withSpark = true
}: {
  count?: number;
  columnsClass?: string;
  withSpark?: boolean;
}) {
  return (
    <div className={columnsClass}>
      {Array.from({ length: count }).map((_, index) => (
        <KPICardSkeleton key={index} withSpark={withSpark} />
      ))}
    </div>
  );
}

export function ChartCardSkeleton({ height = 256 }: { height?: number }) {
  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton width={140} height={14} />
        <Skeleton width={90} height={12} />
      </div>
      <Skeleton height={height} rounded="2xl" />
      <div className="flex justify-between">
        <Skeleton width={80} height={10} />
        <Skeleton width={120} height={10} />
      </div>
    </div>
  );
}

export function BarListSkeleton({
  rows = 5,
  title = true
}: {
  rows?: number;
  title?: boolean;
}) {
  return (
    <div className="card space-y-4">
      {title ? (
        <div className="flex items-center justify-between">
          <Skeleton width={120} height={12} />
          <Skeleton width={60} height={10} />
        </div>
      ) : null}
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Skeleton width={`${50 + ((index * 7) % 30)}%`} height={12} />
              <Skeleton width={40} height={12} />
            </div>
            <Skeleton height={6} rounded="full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({
  rows = 6,
  columns = 5,
  withTitle = true
}: {
  rows?: number;
  columns?: number;
  withTitle?: boolean;
}) {
  return (
    <div className="card space-y-4">
      {withTitle ? (
        <div className="flex items-center justify-between">
          <Skeleton width={140} height={14} />
          <Skeleton width={180} height={32} rounded="xl" />
        </div>
      ) : null}
      <div className="space-y-3">
        <div className="grid items-center gap-3" style={{ gridTemplateColumns: `2fr repeat(${columns - 1}, 1fr)` }}>
          {Array.from({ length: columns }).map((_, index) => (
            <Skeleton key={`h-${index}`} width={index === 0 ? "70%" : "60%"} height={10} />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={`r-${rowIndex}`}
            className="grid items-center gap-3 border-t border-slate/10 pt-3"
            style={{ gridTemplateColumns: `2fr repeat(${columns - 1}, 1fr)` }}
          >
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton
                key={`r-${rowIndex}-c-${colIndex}`}
                width={colIndex === 0 ? `${60 + ((rowIndex * 9) % 30)}%` : `${40 + ((colIndex * 13 + rowIndex * 7) % 40)}%`}
                height={12}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function FilterBarSkeleton({ items = 4 }: { items?: number }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate/10 bg-white/70 px-4 py-3">
      {Array.from({ length: items }).map((_, index) => (
        <Skeleton key={index} width={index === 0 ? 200 : 140} height={36} rounded="xl" />
      ))}
    </div>
  );
}

export function CardListSkeleton({
  count = 4,
  columnsClass = "grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
}: {
  count?: number;
  columnsClass?: string;
}) {
  return (
    <div className={columnsClass}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="card space-y-3">
          <Skeleton width={100} height={12} />
          <Skeleton width={160} height={20} />
          <Skeleton width={80} height={10} />
        </div>
      ))}
    </div>
  );
}

export function FormSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="card space-y-5">
      <Skeleton width={140} height={16} />
      <div className="space-y-4">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton width={120} height={10} />
            <Skeleton height={40} rounded="xl" />
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <Skeleton width={120} height={36} rounded="full" />
      </div>
    </div>
  );
}
