export function cleanName(s: string | null | undefined): string {
  return (s ?? "").trim().replace(/\s+/g, " ")
}

/** name_key = first + last name, trimmed, lower-case, single-spaced. */
export function nameKey(first: string | null | undefined, last: string | null | undefined): string {
  return cleanName(`${cleanName(first)} ${cleanName(last)}`).toLowerCase()
}

export function fullName(m: { firstName: string; lastName: string }): string {
  return cleanName(`${m.firstName} ${m.lastName}`)
}
