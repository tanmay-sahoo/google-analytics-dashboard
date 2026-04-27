import { PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

export default function AdminUsersLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <TableSkeleton rows={10} columns={5} />
    </div>
  );
}
