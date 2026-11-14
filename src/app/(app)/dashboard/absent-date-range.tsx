"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { useSearchParamNavigation } from "@/components/navigation"

/** From / To calendar inputs for the Absent Members card, stored in the URL as abs_from / abs_to. */
export function AbsentDateRange({ from, to, min, max }: { from: string; to: string; min?: string; max?: string }) {
  const { setParams } = useSearchParamNavigation()
  const [f, setF] = useState(from)
  const [t, setT] = useState(to)
  useEffect(() => setF(from), [from])
  useEffect(() => setT(to), [to])

  // Native date inputs report "" until the date is complete, so only apply full dates.
  const apply = (nextFrom: string, nextTo: string) => {
    if (!nextFrom || !nextTo) return
    setParams({ abs_from: nextFrom, abs_to: nextTo, abs_date: null })
  }

  return (
    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-muted-foreground sm:flex-none">
        From
        <Input type="date" className="h-9 w-auto min-w-0 flex-1" value={f} min={min} max={max}
          aria-label="From date" onChange={(e) => { setF(e.target.value); apply(e.target.value, t) }} />
      </label>
      <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-muted-foreground sm:flex-none">
        To
        <Input type="date" className="h-9 w-auto min-w-0 flex-1" value={t} min={min} max={max}
          aria-label="To date" onChange={(e) => { setT(e.target.value); apply(f, e.target.value) }} />
      </label>
    </div>
  )
}
