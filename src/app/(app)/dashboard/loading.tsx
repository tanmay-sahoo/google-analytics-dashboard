import { PageHeaderSkeleton } from "@/components/skeletons";
import DashboardSkeleton from "@/components/DashboardSkeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <PageHeaderSkeleton />
      <DashboardSkeleton />
    </div>
  );
}
