"use client"

import { Children, isValidElement, useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

/** Radix Select can't use "" as an item value, so "All …" style options are stored under this key. */
const EMPTY = "__empty__"
const toRadix = (v: string) => (v === "" ? EMPTY : v)
const fromRadix = (v: string) => (v === EMPTY ? "" : v)

export type SelectOption = { value: string; label: React.ReactNode; disabled?: boolean }

type Props = {
  /** Options as data… */
  options?: SelectOption[]
  /** …or as `<option>` children, like a native select. */
  children?: React.ReactNode
  value?: string
  defaultValue?: string
  /** Same shape as a native change event's target, so callers can keep using `e.target.value`. */
  onChange?: (e: { target: { value: string } }) => void
  onValueChange?: (value: string) => void
  /** Submitted with a surrounding <form> under this name. */
  name?: string
  id?: string
  disabled?: boolean
  required?: boolean
  placeholder?: string
  className?: string
  /** For action menus ("Set status…"): go back to the first option after each choice. */
  resetOnChange?: boolean
  "aria-label"?: string
  "aria-describedby"?: string
}

function optionsFromChildren(children: React.ReactNode): SelectOption[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement<{ value?: string | number; children?: React.ReactNode; disabled?: boolean }>(child) || child.type !== "option") return []
    const { value, children: label, disabled } = child.props
    return [{ value: String(value ?? label ?? ""), label: label ?? String(value ?? ""), disabled }]
  })
}

/** A shadcn Select with the conveniences of a native one. */
export function SelectField({
  options, children, value, defaultValue, onChange, onValueChange, name, id, disabled, required, placeholder, className, resetOnChange, ...aria
}: Props) {
  const opts = options ?? optionsFromChildren(children)
  const first = opts[0]?.value ?? ""
  const [inner, setInner] = useState(defaultValue ?? first)
  const current = value ?? inner

  return (
    <>
      <Select
        value={toRadix(current)}
        disabled={disabled}
        required={required}
        onValueChange={(raw) => {
          const v = fromRadix(raw)
          setInner(resetOnChange ? first : v)
          onValueChange?.(v)
          onChange?.({ target: { value: v } })
        }}
      >
        <SelectTrigger id={id} className={cn("h-9", className)} {...aria}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {opts.map((o) => (
            <SelectItem key={o.value} value={toRadix(o.value)} disabled={o.disabled}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {name && <input type="hidden" name={name} value={current} />}
    </>
  )
}
