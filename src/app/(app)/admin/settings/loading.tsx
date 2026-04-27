import { PageHeaderSkeleton, FormSkeleton } from "@/components/skeletons";

export default function AdminSettingsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withControls={false} />
      <div className="grid gap-6 xl:grid-cols-2">
        <FormSkeleton rows={5} />
        <FormSkeleton rows={4} />
      </div>
    </div>
  );
}
