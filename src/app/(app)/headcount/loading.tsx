import { CardSkeleton, FilterBarSkeleton, HeaderSkeleton, PageLoading, TableSkeleton } from "@/components/page-skeletons"

export default function Loading() {
  return (
    <PageLoading label="weekly headcount">
      <HeaderSkeleton />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
        <CardSkeleton lines={9} />
        <TableSkeleton rows={6} cols={8} />
      </div>
      <FilterBarSkeleton />
      <TableSkeleton rows={8} cols={10} />
    </PageLoading>
  )
}
