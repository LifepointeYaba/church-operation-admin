"use client"

import { createContext, useCallback, useContext, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type Nav = { isPending: boolean; push: (href: string) => void }
const NavigationContext = createContext<Nav>({ isPending: false, push: () => {} })

/**
 * Tracks in-page navigations (filters, date pickers, month arrows) so the page can show
 * skeletons while the server loads the new data, instead of looking frozen.
 */
export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [isPending, start] = useTransition()
  const push = useCallback((href: string) => start(() => router.push(href, { scroll: false })), [router])
  return (
    <NavigationContext.Provider value={{ isPending, push }}>
      {isPending && (
        <div role="progressbar" aria-label="Loading" className="fixed inset-x-0 top-0 z-[90] h-0.5 overflow-hidden bg-primary/15">
          <div className="h-full w-1/3 animate-[progress_1.1s_ease-in-out_infinite] bg-primary" />
        </div>
      )}
      {children}
    </NavigationContext.Provider>
  )
}

export const useNavigation = () => useContext(NavigationContext)

/** Change one or more URL search params (empty value removes it) with loading feedback. */
export function useSearchParamNavigation() {
  const { push, isPending } = useNavigation()
  const path = usePathname()
  const params = useSearchParams()
  const setParams = useCallback((patch: Record<string, string | null | undefined>) => {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v) p.set(k, v)
      else p.delete(k)
    }
    push(`${path}?${p}`)
  }, [params, path, push])
  return { setParams, push, isPending }
}

/** Wraps card content: while new data loads, a skeleton covers it so the layout doesn't jump. */
export function PendingContent({ children, className }: { children: React.ReactNode; className?: string }) {
  const { isPending } = useNavigation()
  return (
    <div className={cn("relative", className)} aria-busy={isPending || undefined}>
      <div className={cn("transition-opacity", isPending && "opacity-0")}>{children}</div>
      {isPending && (
        <div className="absolute inset-0 flex flex-col gap-2 overflow-hidden" aria-hidden>
          <Skeleton className="h-5 w-2/5" />
          <Skeleton className="w-full flex-1 min-h-6" />
          <Skeleton className="h-5 w-3/5" />
        </div>
      )}
    </div>
  )
}

/** A link that changes the URL within the page with the same loading feedback as filters. */
export function NavLink({ href, className, children, ...props }: Omit<React.ComponentProps<"a">, "href"> & { href: string }) {
  const { push } = useNavigation()
  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
        e.preventDefault()
        push(href)
      }}
      {...props}
    >
      {children}
    </a>
  )
}
