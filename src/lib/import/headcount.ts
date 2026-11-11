import { checkServiceDate, isoDate, parseSheetDate, todayLagos } from "../dates"

export const HEADCOUNT_FIELDS = ["workers", "members", "firstTimers", "secondTimers", "male", "female", "children", "guests"] as const
export type HeadcountField = (typeof HEADCOUNT_FIELDS)[number]
export type HeadcountValues = Record<HeadcountField, number> & { total: number }

export type HeadcountRow = HeadcountValues & {
  date: string
  errors: string[]
  warnings: string[]
}

export type ParsedNote = { date: string; type: "streak" | "returnee" | "convert" | "general"; text: string }

export type HeadcountParseResult = {
  rows: HeadcountRow[]
  notes: ParsedNote[]
  skippedBlocks: { title: string; reason: string }[]
}

const LABELS: Record<string, HeadcountField | "total"> = {
  workers: "workers",
  members: "members",
  "first timers": "firstTimers",
  "first timer": "firstTimers",
  "second timers": "secondTimers",
  "second timer": "secondTimers",
  "total number": "total",
  total: "total",
  male: "male",
  female: "female",
  children: "children",
  guests: "guests",
  guest: "guests",
  pastors: "guests",
  visitors: "guests",
}

const MONTH_NAMES = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]

/** Register adults only: Workers + Members + First + Second timers. */
export function registerTotal(v: Pick<HeadcountValues, "workers" | "members" | "firstTimers" | "secondTimers">) {
  return v.workers + v.members + v.firstTimers + v.secondTimers
}

/** Everyone on the day: the register numbers plus children and guests/pastors added by hand. */
export function computeTotal(v: Pick<HeadcountValues, "workers" | "members" | "firstTimers" | "secondTimers"> & { children?: number; guests?: number }) {
  return registerTotal(v) + (v.children ?? 0) + (v.guests ?? 0)
}

/** Validate a headcount: date must be a past Sunday, both totals must agree (warnings only). */
export function validateHeadcount(date: Date | null, v: HeadcountValues, today = todayLagos()) {
  const errors: string[] = []
  const warnings: string[] = []
  if (!date) errors.push("Invalid date")
  else {
    const c = checkServiceDate(date, today)
    if (!c.ok) errors.push(c.reason)
  }
  for (const f of [...HEADCOUNT_FIELDS, "total"] as const) {
    if (!Number.isInteger(v[f]) || v[f] < 0) errors.push(`${f} must be a whole number ≥ 0`)
  }
  // Older Chart sheets count children inside the role numbers, so either way of adding up is accepted.
  const byRole = computeTotal(v)
  const byGender = v.male + v.female + v.children + v.guests
  if (byRole !== v.total && registerTotal(v) + v.guests !== v.total) warnings.push(`Workers+Members+First+Second+Children+Guests = ${byRole}, but Total is ${v.total}`)
  if (byGender !== v.total) warnings.push(`Male+Female+Children+Guests = ${byGender}, but Total is ${v.total}`)
  return { errors, warnings }
}

export function noteType(text: string): ParsedNote["type"] {
  const t = text.toLowerCase()
  if (/convert/.test(t)) return "convert"
  if (/in a row|consecutive|consistently/.test(t)) return "streak"
  if (/return|came back|came around|cameback/.test(t)) return "returnee"
  return "general"
}

function toInt(s: string | undefined): number {
  const n = Number((s ?? "").replace(/[^\d.-]/g, ""))
  return Number.isFinite(n) && (s ?? "").trim() !== "" ? Math.round(n) : NaN
}

/** Parse either the Chart-sheet block layout or a simple table with a Date column. */
export function parseHeadcountGrid(grid: string[][], today = todayLagos()): HeadcountParseResult {
  const header = (grid[0] ?? []).map((h) => h.trim().toLowerCase())
  if (header.includes("date")) return parseTable(grid, today)
  return parseChart(grid, today)
}

function finishRow(dateRaw: string, vals: Partial<HeadcountValues>, today: Date, seen: Set<string>): HeadcountRow {
  const d = parseSheetDate(dateRaw)
  const v: HeadcountValues = {
    workers: vals.workers ?? NaN,
    members: vals.members ?? NaN,
    firstTimers: vals.firstTimers ?? NaN,
    secondTimers: vals.secondTimers ?? NaN,
    male: vals.male ?? NaN,
    female: vals.female ?? NaN,
    children: Number.isNaN(vals.children ?? NaN) ? 0 : (vals.children as number),
    guests: Number.isNaN(vals.guests ?? NaN) ? 0 : (vals.guests as number),
    total: NaN,
  }
  // Headcount sheets count children inside the role numbers, so a missing Total is roles + guests.
  v.total = Number.isNaN(vals.total ?? NaN) ? registerTotal(v) + v.guests : (vals.total as number)
  const { errors, warnings } = validateHeadcount(d, v, today)
  const date = d ? isoDate(d) : dateRaw
  if (d && seen.has(date)) errors.push("Duplicate date in file")
  seen.add(date)
  return { ...v, date, errors, warnings }
}

function parseTable(grid: string[][], today: Date): HeadcountParseResult {
  const header = grid[0].map((h) => h.trim().toLowerCase())
  const dateCol = header.indexOf("date")
  const cols = header.map((h) => LABELS[h])
  const seen = new Set<string>()
  const rows: HeadcountRow[] = []
  const notes: ParsedNote[] = []
  const noteCol = header.findIndex((h) => h === "notes" || h === "note")
  for (const r of grid.slice(1)) {
    if (!r[dateCol]?.trim()) continue
    const vals: Partial<HeadcountValues> = {}
    cols.forEach((f, i) => f && (vals[f] = toInt(r[i])))
    const row = finishRow(r[dateCol], vals, today, seen)
    rows.push(row)
    if (noteCol >= 0 && r[noteCol]?.trim()) {
      for (const line of r[noteCol].split(/\n|;/).map((l) => l.trim()).filter(Boolean)) {
        notes.push({ date: row.date, type: noteType(line), text: line })
      }
    }
  }
  return { rows, notes, skippedBlocks: [] }
}

function parseChart(grid: string[][], today: Date): HeadcountParseResult {
  const rows: HeadcountRow[] = []
  const notes: ParsedNote[] = []
  const skippedBlocks: HeadcountParseResult["skippedBlocks"] = []
  const seen = new Set<string>()

  const starts: number[] = []
  grid.forEach((r, i) => {
    if (/^\s*average attendance in/i.test(r[0] ?? "")) starts.push(i)
  })
  if (!starts.length) starts.push(0)

  starts.forEach((start, bi) => {
    const end = bi + 1 < starts.length ? starts[bi + 1] : grid.length
    const block = grid.slice(start, end)
    const title = (block[0]?.[0] ?? "").trim()
    const titleMonth = MONTH_NAMES.findIndex((m) => title.toLowerCase().includes(m))

    const dateRowIdx = block.findIndex((r) => r.slice(1).some((c) => parseSheetDate(c)))
    if (dateRowIdx < 0) return skippedBlocks.push({ title, reason: "No date row found" })
    const dateCols = block[dateRowIdx]
      .map((c, col) => ({ col, raw: c.trim(), d: col > 0 ? parseSheetDate(c) : null }))
      .filter((x) => x.d)

    if (titleMonth >= 0 && dateCols.some((x) => x.d!.getUTCMonth() !== titleMonth)) {
      return skippedBlocks.push({
        title,
        reason: `Dates (${dateCols.map((x) => x.raw).join(", ")}) do not all fall in ${MONTH_NAMES[titleMonth]}`,
      })
    }

    const vals = new Map<number, Partial<HeadcountValues>>(dateCols.map((x) => [x.col, {}]))
    let lastLabelRow = dateRowIdx
    block.forEach((r, ri) => {
      if (ri <= dateRowIdx) return
      const f = LABELS[(r[0] ?? "").trim().toLowerCase()]
      if (!f) return
      lastLabelRow = ri
      dateCols.forEach((x) => (vals.get(x.col)![f] = toInt(r[x.col])))
    })
    const blockRows = dateCols.map((x) => finishRow(x.raw, vals.get(x.col)!, today, seen))
    rows.push(...blockRows)

    // Free-text notes sit under each date column after the label rows.
    block.slice(lastLabelRow + 1).forEach((r) => {
      dateCols.forEach((x, i) => {
        const text = (r[x.col] ?? "").trim()
        if (text && !/^\d+(\.\d+)?$/.test(text)) notes.push({ date: blockRows[i].date, type: noteType(text), text })
      })
    })
  })
  return { rows, notes, skippedBlocks }
}
