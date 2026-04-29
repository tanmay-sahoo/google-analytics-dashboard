import { PageHeaderSkeleton, FormSkeleton } from "@/components/skeletons";
import Skeleton from "@/components/Skeleton";

export default function ProjectDetailLoading() {
  return (
    <div className="space-y-8">
      <PageHeaderSkeleton withControls={false} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <FormSkeleton rows={5} />
        <FormSkeleton rows={3} />
      </div>
      <div className="space-y-4">
        <Skeleton width={320} height={36} rounded="xl" />
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton width={120} height={32} rounded="full" />
          <Skeleton width={120} height={32} rounded="full" />
          <Skeleton width={120} height={32} rounded="full" />
          <Skeleton width={120} height={32} rounded="full" />
        </div>
      </div>
    </div>
  );
}
