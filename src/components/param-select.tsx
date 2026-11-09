"use client"

import { SelectField } from "./select-field"
import { useSearchParamNavigation } from "./navigation"

/** A select bound to one URL search param; an empty value removes the param. Shows loading while the page updates. */
export function ParamSelect({ name, value, options, label, className }: {
  name: string; value: string; options: { value: string; label: string }[]; label: string; className?: string
}) {
  const { setParams } = useSearchParamNavigation()
  return (
    <SelectField aria-label={label} className={className} value={value} options={options} onValueChange={(v) => setParams({ [name]: v })} />
  )
}
