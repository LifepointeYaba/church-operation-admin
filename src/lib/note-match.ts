/**
 * Reads second-timer distribution lines from the weekly notes, e.g.
 *   "1 returned from last week", "2 returned from 20 September", "1 from 20 Sept",
 *   "1 returned from 3 May", "1 returned from Apr '25", "1 returned from last year"
 * and says which first-visit dates each line is about.
 */

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]

function monthOf(word: string): number | null {
  const w = word.toLowerCase()
  if (w.length < 3) return null
  const i = MONTHS.findIndex((m) => w.startsWith(m) || (m === "sep" && w.startsWith("sept")))
  return i < 0 ? null : i + 1
}

function yearOf(s: string | undefined): number | null {
  if (!s) return null
  const n = Number(s.replace("'", ""))
  if (!Number.isInteger(n)) return null
  return n < 100 ? 2000 + n : n
}

const pad = (n: number) => String(n).padStart(2, "0")

export type DistributionLine = {
  /** How many people the note says. */
  count: number
  /** Does a first-visit date (ISO) belong to this line? `prevSunday` is the Sunday before the note's Sunday. */
  matches: (firstVisitIso: string, prevSunday: string | null) => boolean
}

/** Parse one note line relative to the Sunday it was written for (`sundayIso`). Null if it isn't a distribution line. */
export function parseDistributionLine(text: string, sundayIso: string): DistributionLine | null {
  const m = text.trim().match(/^(\d+)\s+(?:people\s+|person\s+)?(?:returned\s+|came\s+back\s+)?from\s+(.+)$/i)
  if (!m) return null
  const count = Number(m[1])
  const phrase = m[2].toLowerCase().replace(/[.,]/g, "").replace(/\s+/g, " ").trim()
  const sy = Number(sundayIso.slice(0, 4))
  const smd = sundayIso.slice(5)

  if (phrase === "last week" || phrase === "last sunday") {
    return { count, matches: (d, prev) => prev != null && d === prev }
  }
  if (phrase === "last year") return { count, matches: (d) => Number(d.slice(0, 4)) === sy - 1 }
  if (phrase === "this year") return { count, matches: (d) => Number(d.slice(0, 4)) === sy && d < sundayIso }
  if (phrase === "last month") {
    const lm = new Date(Date.UTC(sy, Number(sundayIso.slice(5, 7)) - 2, 1)).toISOString().slice(0, 7)
    return { count, matches: (d) => d.startsWith(lm) }
  }

  // "20 September", "20th Sept 2025", "3 May"
  let dm = phrase.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)(?:\s+('?\d{2,4}))?$/)
  let day: number | null = null
  let month: number | null = null
  let year: number | null = null
  if (dm) {
    day = Number(dm[1]); month = monthOf(dm[2]); year = yearOf(dm[3])
  } else if ((dm = phrase.match(/^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+('?\d{2,4}))?$/)) && !/^'/.test(dm[2])) {
    // "Sept 20", "May 3 2025"
    month = monthOf(dm[1]); day = Number(dm[2]); year = yearOf(dm[3])
    // "Apr 25" is ambiguous; treat a 2-digit number after a month as a day only when it's a valid day.
    if (day > 31) { year = yearOf(dm[2]); day = null }
  } else if ((dm = phrase.match(/^([a-z]+)(?:\s+('?\d{2,4}))?$/))) {
    // "April", "Apr '25", "April 2025"
    month = monthOf(dm[1]); year = yearOf(dm[2])
  }
  if (!month) return null

  if (day) {
    if (day > 31) return null
    const md = `${pad(month)}-${pad(day)}`
    // Without a year, it's the most recent such date before the Sunday.
    const y = year ?? (md < smd ? sy : sy - 1)
    const iso = `${y}-${md}`
    return { count, matches: (d) => d === iso }
  }
  const mm = pad(month)
  const y = year ?? (mm <= sundayIso.slice(5, 7) ? sy : sy - 1)
  const ym = `${y}-${mm}`
  return { count, matches: (d) => d.startsWith(ym) && d < sundayIso }
}
