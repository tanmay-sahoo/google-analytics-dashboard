import { PageHeaderSkeleton, FormSkeleton, TableSkeleton } from "@/components/skeletons";

export default function ProjectDetailLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withControls={false} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <FormSkeleton rows={5} />
        <FormSkeleton rows={3} />
      </div>
      <TableSkeleton rows={6} columns={4} />
    </div>
  );
}
