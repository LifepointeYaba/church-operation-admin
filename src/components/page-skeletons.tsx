import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/** Building blocks for loading screens. Shapes mirror the real page so nothing jumps when data arrives. */

export function PageLoading({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading {label}…</span>
      {children}
    </div>
  )
}

export function HeaderSkeleton({ action = false }: { action?: boolean }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72 max-w-[70vw]" />
      </div>
      {action && <Skeleton className="h-9 w-32" />}
    </div>
  )
}

export function FilterBarSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-wrap gap-2 rounded-xl border p-2">
      {Array.from({ length: count }, (_, i) => <Skeleton key={i} className="h-9 w-36" />)}
    </div>
  )
}

export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="space-y-3 rounded-xl border p-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-28" />
        </div>
      ))}
    </div>
  )
}

export function CardSkeleton({ className, lines = 4, title = true }: { className?: string; lines?: number; title?: boolean }) {
  return (
    <div className={cn("space-y-4 rounded-xl border p-6", className)}>
      {title && (
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
      )}
      <div className="space-y-2.5">
        {Array.from({ length: lines }, (_, i) => <Skeleton key={i} className={cn("h-4", i % 3 === 2 ? "w-2/3" : "w-full")} />)}
      </div>
    </div>
  )
}

export function TableSkeleton({ rows = 8, cols = 5, className }: { rows?: number; cols?: number; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-xl border", className)}>
      <div className="flex gap-4 border-b bg-muted/50 px-4 py-3">
        {Array.from({ length: cols }, (_, i) => <Skeleton key={i} className={cn("h-4", i === 0 ? "w-32" : "w-16")} />)}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-4 border-b px-4 py-3 last:border-0">
          {Array.from({ length: cols }, (_, i) => <Skeleton key={i} className={cn("h-4", i === 0 ? "w-40" : "w-16")} />)}
        </div>
      ))}
    </div>
  )
}

export function ListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="divide-y rounded-lg border">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex min-h-14 items-center gap-3 px-3 py-2">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex-1 space-y-1.5"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-1/3" /></div>
        </div>
      ))}
    </div>
  )
}
