import { PageHeaderSkeleton, CardListSkeleton } from "@/components/skeletons";

export default function ProjectsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <CardListSkeleton
        count={8}
        columnsClass="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      />
    </div>
  );
}
