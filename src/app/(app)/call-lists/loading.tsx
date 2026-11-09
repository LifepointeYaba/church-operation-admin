import { Skeleton } from "@/components/ui/skeleton"
import { HeaderSkeleton, PageLoading, TableSkeleton } from "@/components/page-skeletons"

export default function Loading() {
  return (
    <PageLoading label="call lists">
      <HeaderSkeleton action />
      <div className="flex flex-wrap gap-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-9 w-32" />)}</div>
      <TableSkeleton rows={10} cols={5} />
    </PageLoading>
  )
}
