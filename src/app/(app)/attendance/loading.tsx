import { Skeleton } from "@/components/ui/skeleton"
import { ListSkeleton, PageLoading } from "@/components/page-skeletons"

export default function Loading() {
  return (
    <PageLoading label="attendance">
      <div className="mx-auto max-w-2xl space-y-3">
        <div className="flex gap-2"><Skeleton className="h-11 flex-1" /><Skeleton className="h-11 w-16" /></div>
        <Skeleton className="h-11 w-full" />
        <div className="flex justify-between"><Skeleton className="h-5 w-28" /><Skeleton className="h-5 w-36" /></div>
        <ListSkeleton rows={10} />
      </div>
    </PageLoading>
  )
}
