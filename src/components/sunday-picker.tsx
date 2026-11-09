"use client"

import { SelectField } from "./select-field"
import { useSearchParamNavigation } from "./navigation"
import { formatDate } from "@/lib/dates"

export function SundayPicker({ dates, value }: { dates: string[]; value: string }) {
  const { setParams } = useSearchParamNavigation()
  return (
    <SelectField aria-label="Sunday" value={value} onValueChange={(date) => setParams({ date })}
      options={dates.map((d) => ({ value: d, label: formatDate(d, "long") }))} />
  )
}
