import { FilterBarSkeleton, HeaderSkeleton, PageLoading, TableSkeleton } from "@/components/page-skeletons"

export default function Loading() {
  return (
    <PageLoading label="members">
      <HeaderSkeleton action />
      <FilterBarSkeleton count={5} />
      <TableSkeleton rows={12} cols={6} />
    </PageLoading>
  )
}
