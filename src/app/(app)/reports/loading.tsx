import {
  PageHeaderSkeleton,
  FilterBarSkeleton,
  KPIGridSkeleton,
  TableSkeleton,
  ChartCardSkeleton
} from "@/components/skeletons";

export default function ReportsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <FilterBarSkeleton items={5} />
      <KPIGridSkeleton count={4} withSpark={false} />
      <div className="grid gap-4 md:grid-cols-2">
        <ChartCardSkeleton height={200} />
        <ChartCardSkeleton height={200} />
      </div>
      <TableSkeleton rows={8} columns={5} />
    </div>
  );
}
