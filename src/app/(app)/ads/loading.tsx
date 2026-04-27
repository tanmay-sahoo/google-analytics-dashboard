import {
  PageHeaderSkeleton,
  FilterBarSkeleton,
  KPIGridSkeleton,
  ChartCardSkeleton,
  TableSkeleton
} from "@/components/skeletons";

export default function AdsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <FilterBarSkeleton items={4} />
      <KPIGridSkeleton
        count={10}
        columnsClass="grid gap-4 md:grid-cols-2 xl:grid-cols-5"
      />
      <ChartCardSkeleton height={280} />
      <TableSkeleton rows={6} columns={8} />
      <div className="grid gap-4 xl:grid-cols-2">
        <TableSkeleton rows={5} columns={4} />
        <TableSkeleton rows={5} columns={4} />
      </div>
    </div>
  );
}
