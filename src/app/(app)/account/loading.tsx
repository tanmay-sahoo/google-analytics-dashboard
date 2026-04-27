import { PageHeaderSkeleton, FormSkeleton } from "@/components/skeletons";

export default function AccountLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withControls={false} />
      <FormSkeleton rows={4} />
    </div>
  );
}
