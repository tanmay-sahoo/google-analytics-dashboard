import { PageHeaderSkeleton, FilterBarSkeleton, TableSkeleton } from "@/components/skeletons";

export default function MerchantLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <FilterBarSkeleton items={3} />
      <TableSkeleton rows={10} columns={7} />
    </div>
  );
}
