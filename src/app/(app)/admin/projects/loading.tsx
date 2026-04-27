import { PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

export default function AdminProjectsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <TableSkeleton rows={10} columns={6} />
    </div>
  );
}
