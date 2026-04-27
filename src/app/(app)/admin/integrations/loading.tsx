import { PageHeaderSkeleton, FormSkeleton } from "@/components/skeletons";

export default function AdminIntegrationsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withControls={false} />
      <div className="grid gap-6 xl:grid-cols-2">
        <FormSkeleton rows={4} />
        <FormSkeleton rows={4} />
        <FormSkeleton rows={3} />
        <FormSkeleton rows={3} />
      </div>
    </div>
  );
}
