import { CardSkeleton, FilterBarSkeleton, HeaderSkeleton, PageLoading, StatCardsSkeleton } from "@/components/page-skeletons"

export default function Loading() {
  return (
    <PageLoading label="trends">
      <HeaderSkeleton />
      <FilterBarSkeleton count={4} />
      <StatCardsSkeleton />
      <CardSkeleton lines={8} />
      <div className="grid gap-4 md:grid-cols-2"><CardSkeleton /><CardSkeleton /></div>
    </PageLoading>
  )
}
