import { Skeleton } from "@/components/ui/skeleton"
import { CardSkeleton, PageLoading } from "@/components/page-skeletons"

export default function Loading() {
  return (
    <PageLoading label="member profile">
      <div className="flex flex-wrap items-center gap-4">
        <Skeleton className="size-14 rounded-full" />
        <div className="space-y-2"><Skeleton className="h-7 w-56" /><Skeleton className="h-4 w-40" /></div>
      </div>
      <div className="flex flex-wrap gap-2">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-9 w-28" />)}</div>
      <div className="grid gap-4 lg:grid-cols-3">
        <CardSkeleton className="lg:col-span-2" lines={6} />
        <CardSkeleton lines={5} />
      </div>
      <CardSkeleton lines={4} />
    </PageLoading>
  )
}
