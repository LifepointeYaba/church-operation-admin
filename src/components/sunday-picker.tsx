"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { NativeSelect } from "./native-select"
import { formatDate } from "@/lib/dates"

export function SundayPicker({ dates, value }: { dates: string[]; value: string }) {
  const router = useRouter()
  const path = usePathname()
  const params = useSearchParams()
  return (
    <NativeSelect
      aria-label="Sunday"
      value={value}
      onChange={(e) => {
        const p = new URLSearchParams(params)
        p.set("date", e.target.value)
        router.push(`${path}?${p}`)
      }}
    >
      {dates.map((d) => <option key={d} value={d}>{formatDate(d, "long")}</option>)}
    </NativeSelect>
  )
}
