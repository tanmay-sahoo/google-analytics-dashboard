import {
  KPIGridSkeleton,
  ChartCardSkeleton,
  BarListSkeleton,
  CardListSkeleton
} from "@/components/skeletons";
import Skeleton from "@/components/Skeleton";

export default function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="card space-y-6">
          <KPIGridSkeleton count={4} columnsClass="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" />
          <ChartCardSkeleton height={256} />
        </div>
        <div className="card space-y-4">
          <Skeleton width={180} height={12} />
          <Skeleton width={120} height={36} rounded="lg" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Skeleton width={`${50 + ((index * 11) % 30)}%`} height={12} />
                  <Skeleton width={32} height={12} />
                </div>
                <Skeleton height={6} rounded="full" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <BarListSkeleton rows={5} />
        <BarListSkeleton rows={5} />
        <BarListSkeleton rows={5} />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <BarListSkeleton rows={5} />
        <BarListSkeleton rows={5} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton width={160} height={12} />
          <Skeleton width={80} height={10} />
        </div>
        <CardListSkeleton count={4} />
      </section>
    </div>
  );
}
