import { Skeleton } from "@/components/ui/skeleton"
import { CardSkeleton, FilterBarSkeleton, PageLoading, StatCardsSkeleton } from "@/components/page-skeletons"

/** Default loading screen (dashboard-shaped). Routes with a different layout have their own loading.tsx. */
export default function Loading() {
  return (
    <PageLoading label="dashboard">
      <Skeleton className="h-36 rounded-2xl" />
      <FilterBarSkeleton />
      <StatCardsSkeleton />
      <CardSkeleton lines={8} />
      <div className="grid gap-4 md:grid-cols-2">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </PageLoading>
  )
}
