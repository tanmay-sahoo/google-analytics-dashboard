import { PageHeaderSkeleton, FilterBarSkeleton, TableSkeleton } from "@/components/skeletons";

export default function AdminLogsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <FilterBarSkeleton items={4} />
      <TableSkeleton rows={14} columns={5} />
    </div>
  );
}
