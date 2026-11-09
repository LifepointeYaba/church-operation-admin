import { CardSkeleton, HeaderSkeleton, PageLoading, TableSkeleton } from "@/components/page-skeletons"

export default function Loading() {
  return (
    <PageLoading label="uploads">
      <HeaderSkeleton />
      <CardSkeleton lines={3} />
      <CardSkeleton lines={4} />
      <TableSkeleton rows={5} cols={6} />
    </PageLoading>
  )
}
