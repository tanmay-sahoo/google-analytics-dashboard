import {
  PageHeaderSkeleton,
  FilterBarSkeleton,
  TableSkeleton
} from "@/components/skeletons";

export default function ReportDetailLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <FilterBarSkeleton items={4} />
      <TableSkeleton rows={12} columns={6} />
    </div>
  );
}
