import { PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

export default function AdminAlertsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <TableSkeleton rows={10} columns={6} />
    </div>
  );
}
