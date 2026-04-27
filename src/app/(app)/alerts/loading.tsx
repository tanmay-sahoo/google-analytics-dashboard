import { PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

export default function AlertsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <TableSkeleton rows={8} columns={6} />
    </div>
  );
}
