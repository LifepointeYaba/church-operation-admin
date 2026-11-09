import { FilterBarSkeleton, HeaderSkeleton, PageLoading, TableSkeleton } from "@/components/page-skeletons"

export default function Loading() {
  return (
    <PageLoading label="audit log">
      <HeaderSkeleton />
      <FilterBarSkeleton count={5} />
      <TableSkeleton rows={12} cols={5} />
    </PageLoading>
  )
}
