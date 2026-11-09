import { CardSkeleton, HeaderSkeleton, PageLoading } from "@/components/page-skeletons"

export default function Loading() {
  return (
    <PageLoading label="settings">
      <HeaderSkeleton />
      <div className="grid gap-4 md:grid-cols-2">
        <CardSkeleton lines={4} />
        <CardSkeleton lines={6} />
        <CardSkeleton lines={8} />
        <CardSkeleton lines={3} />
      </div>
    </PageLoading>
  )
}
