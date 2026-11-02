/** Shown while a page's data loads. */
export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="shimmer h-28 rounded-2xl" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="shimmer h-28 rounded-xl" />)}
      </div>
      <div className="shimmer h-80 rounded-xl" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="shimmer h-56 rounded-xl" />
        <div className="shimmer h-56 rounded-xl" />
      </div>
    </div>
  )
}
