"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { NativeSelect } from "./native-select"

/** A select bound to one URL search param; an empty value removes the param. */
export function ParamSelect({ name, value, options, label, className }: {
  name: string; value: string; options: { value: string; label: string }[]; label: string; className?: string
}) {
  const router = useRouter()
  const path = usePathname()
  const params = useSearchParams()
  return (
    <NativeSelect
      aria-label={label}
      className={className}
      value={value}
      onChange={(e) => {
        const p = new URLSearchParams(params)
        if (e.target.value) p.set(name, e.target.value)
        else p.delete(name)
        router.push(`${path}?${p}`, { scroll: false })
      }}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </NativeSelect>
  )
}
