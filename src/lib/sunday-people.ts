import { prisma } from "./db"
import { isoDate } from "./dates"

export type SundayPerson = { id: number; name: string; phone: string | null; status: string }
export type PersonGroup = { key: string; title: string; people: SundayPerson[] }

export type SundayDetails = {
  date: string
  label: string | null
  present: number
  /** Notes for the day; `people` are those present whose name the note mentions. */
  notes: { id: number; text: string; people: SundayPerson[] }[]
  firstTimers: SundayPerson[]
  /** Second timers, grouped by when they first came (the "returned from …" lines). */
  secondTimers: PersonGroup[]
  /** People (past their second visit) who came back after missing `breakWeeks`+ Sundays, grouped by when they last came. */
  backAfterBreak: PersonGroup[]
  breakWeeks: number
}

const nice = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()

/** Who is behind a Sunday's numbers, worked out from the attendance register. */
export async function sundayDetails(dateIso: string, breakWeeks: number): Promise<SundayDetails | null> {
  const date = new Date(`${dateIso}T00:00:00Z`)
  const service = await prisma.service.findUnique({ where: { date }, include: { notes: { orderBy: { id: "asc" } } } })
  if (!service) return null

  // Every record-taken Sunday up to this one, so gaps can be counted in Sundays, not calendar weeks.
  const sundays = (await prisma.service.findMany({
    where: { recordTaken: true, date: { lte: date } }, select: { date: true }, orderBy: { date: "asc" },
  })).map((s) => isoDate(s.date))
  const pos = new Map(sundays.map((d, i) => [d, i]))
  const here = pos.get(dateIso) ?? sundays.length

  const rows = await prisma.$queryRaw<{ id: number; first_name: string; last_name: string; phone: string | null; status: string; ord: number; prev: Date | null }[]>`
    WITH visits AS (
      SELECT a.member_id, s.date,
        (ROW_NUMBER() OVER (PARTITION BY a.member_id ORDER BY s.date))::int AS ord,
        LAG(s.date) OVER (PARTITION BY a.member_id ORDER BY s.date) AS prev
      FROM attendance a JOIN services s ON s.id = a.service_id
      WHERE s.record_taken AND s.date <= ${date}::date
    )
    SELECT m.id, m.first_name, m.last_name, m.phone, m.status, v.ord, v.prev
    FROM visits v JOIN members m ON m.id = v.member_id
    WHERE v.date = ${date}::date AND m.deleted_at IS NULL
    ORDER BY m.first_name, m.last_name`

  const person = (r: (typeof rows)[number]): SundayPerson => ({ id: r.id, name: `${r.first_name} ${r.last_name}`.trim(), phone: r.phone, status: r.status })
  const group = (map: Map<string, PersonGroup>, key: string, title: string, p: SundayPerson) => {
    if (!map.has(key)) map.set(key, { key, title, people: [] })
    map.get(key)!.people.push(p)
  }

  const firstTimers: SundayPerson[] = []
  const second = new Map<string, PersonGroup>()
  const back = new Map<string, PersonGroup>()
  for (const r of rows) {
    const p = person(r)
    const prev = r.prev ? isoDate(r.prev) : null
    const missed = prev != null && pos.has(prev) ? here - pos.get(prev)! - 1 : 0
    // Same rule as the weekly numbers: workers never count as first or second timers.
    if (r.ord === 1 && r.status !== "Worker") firstTimers.push(p)
    else if (r.ord === 2 && r.status !== "Worker" && prev) {
      group(second, prev, missed === 0 ? `Returned from last week (${nice(prev)})` : `First came ${nice(prev)}`, p)
    } else if (r.ord > 2 && prev && missed >= breakWeeks) {
      group(back, prev, `Last came ${nice(prev)} · missed ${missed} Sundays`, p)
    }
  }
  const newestFirst = (m: Map<string, PersonGroup>) => [...m.values()].sort((a, b) => b.key.localeCompare(a.key))

  // Link notes like "Taiwo God's Heritage came 3 times in a row" to the person, when they were present.
  const people = rows.map(person)
  const notes = service.notes.map((n) => {
    const text = ` ${norm(n.text)} `
    const named = people.filter((p) => {
      const parts = norm(p.name).split(" ").filter((w) => w.length > 1)
      return parts.length >= 2 && parts.every((w) => text.includes(` ${w} `))
    })
    return { id: n.id, text: n.text, people: named }
  })

  return {
    date: dateIso,
    label: service.label,
    present: rows.length,
    notes,
    firstTimers,
    secondTimers: newestFirst(second),
    backAfterBreak: newestFirst(back),
    breakWeeks,
  }
}

/** Labels used before, most recent first, for suggestions. */
export async function knownSundayLabels(): Promise<string[]> {
  const rows = await prisma.service.findMany({ where: { label: { not: null } }, select: { label: true }, orderBy: { date: "desc" } })
  return [...new Set(rows.map((r) => r.label!))]
}
