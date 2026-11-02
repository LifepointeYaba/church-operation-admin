const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
}

/** All service dates are stored as UTC midnight of the calendar day. */
export function utcDate(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d))
}

/** Parse "21-Jul-24", "4-Jan-2026", "2026-01-04" or "04/01/2026" (d/m/y) into a UTC date. */
export function parseSheetDate(raw: string): Date | null {
  const s = raw.trim()
  let m = s.match(/^(\d{1,2})[-\s]([A-Za-z]{3,4})[-\s](\d{2}|\d{4})$/)
  if (m) {
    const mon = MONTHS[m[2].toLowerCase()]
    if (mon === undefined) return null
    let y = Number(m[3])
    if (y < 100) y += 2000
    return validDate(y, mon, Number(m[1]))
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) return validDate(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return validDate(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
  return null
}

function validDate(y: number, m: number, d: number): Date | null {
  const dt = utcDate(y, m, d)
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m && dt.getUTCDate() === d ? dt : null
}

export function isSunday(d: Date): boolean {
  return d.getUTCDay() === 0
}

/** Today's calendar date in Lagos (WAT, UTC+1), as UTC midnight. */
export function todayLagos(now = new Date()): Date {
  const lagos = new Date(now.getTime() + 60 * 60 * 1000)
  return utcDate(lagos.getUTCFullYear(), lagos.getUTCMonth(), lagos.getUTCDate())
}

/** Most recent Sunday on or before the given date. */
export function lastSunday(from = todayLagos()): Date {
  return new Date(from.getTime() - from.getUTCDay() * 86400000)
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function fromIso(s: string): Date | null {
  return parseSheetDate(s)
}

export function formatDate(d: Date | string, style: "short" | "long" = "short"): string {
  const dt = typeof d === "string" ? new Date(d) : d
  return dt.toLocaleDateString("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: style === "long" ? "numeric" : "2-digit",
  })
}

export type SundayCheck = { ok: true } | { ok: false; reason: string }

export function checkServiceDate(d: Date, today = todayLagos()): SundayCheck {
  if (!isSunday(d)) return { ok: false, reason: `${isoDate(d)} is not a Sunday` }
  if (d.getTime() > today.getTime()) return { ok: false, reason: `${isoDate(d)} is in the future` }
  return { ok: true }
}
