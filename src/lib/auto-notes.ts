import { prisma } from "./db"
import { isoDate } from "./dates"

export type AutoNote = { type: "streak" | "returnee"; text: string }

/** "20 Sept", or "20 Sept 2025" when it's not the same year as the Sunday. */
function shortDate(iso: string, sundayIso: string) {
  const d = new Date(`${iso}T00:00:00Z`)
  const sameYear = iso.slice(0, 4) === sundayIso.slice(0, 4)
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC", ...(sameYear ? {} : { year: "numeric" }) })
}

/**
 * Notes worked out from the attendance register, in the same style as the hand-written ones, e.g.
 *   "Taiwo God's Heritage came 3 times in a row"
 *   "Second Timers Distribution" / "1 returned from last week" / "2 returned from 20 Sept"
 * One list per record-taken Sunday between the two dates (inclusive). Workers never count as first or second timers.
 */
export async function autoNotesBetween(fromIso: string, toIso: string): Promise<Record<string, AutoNote[]>> {
  const from = new Date(`${fromIso}T00:00:00Z`)
  const to = new Date(`${toIso}T00:00:00Z`)
  const sundays = (await prisma.service.findMany({
    where: { recordTaken: true, date: { lte: to } }, select: { date: true }, orderBy: { date: "asc" },
  })).map((s) => isoDate(s.date))
  const pos = new Map(sundays.map((d, i) => [d, i]))

  const rows = await prisma.$queryRaw<{ date: Date; first_name: string; last_name: string; ord: number; prev: Date | null; prev2: Date | null }[]>`
    WITH visits AS (
      SELECT a.member_id, s.date,
        (ROW_NUMBER() OVER (PARTITION BY a.member_id ORDER BY s.date))::int AS ord,
        LAG(s.date) OVER (PARTITION BY a.member_id ORDER BY s.date) AS prev,
        LAG(s.date, 2) OVER (PARTITION BY a.member_id ORDER BY s.date) AS prev2
      FROM attendance a JOIN services s ON s.id = a.service_id
      WHERE s.record_taken AND s.date <= ${to}::date
    )
    SELECT v.date, m.first_name, m.last_name, v.ord, v.prev, v.prev2
    FROM visits v JOIN members m ON m.id = v.member_id
    WHERE v.date >= ${from}::date AND v.ord IN (2, 3)
      AND m.deleted_at IS NULL AND m.status IS DISTINCT FROM 'Worker'
    ORDER BY v.date, m.first_name, m.last_name`

  const streaks = new Map<string, string[]>()
  const second = new Map<string, Map<string, number>>()
  for (const r of rows) {
    const d = isoDate(r.date)
    const i = pos.get(d)
    if (i == null || !r.prev) continue
    const prev = isoDate(r.prev)
    if (r.ord === 2) {
      const by = second.get(d) ?? new Map<string, number>()
      by.set(prev, (by.get(prev) ?? 0) + 1)
      second.set(d, by)
    } else if (r.ord === 3 && r.prev2 && pos.get(prev) === i - 1 && pos.get(isoDate(r.prev2)) === i - 2) {
      const list = streaks.get(d) ?? []
      list.push(`${r.first_name} ${r.last_name}`.trim())
      streaks.set(d, list)
    }
  }

  const out: Record<string, AutoNote[]> = {}
  for (const d of sundays) {
    if (d < fromIso) continue
    const notes: AutoNote[] = []
    for (const name of streaks.get(d) ?? []) notes.push({ type: "streak", text: `${name} came 3 times in a row` })
    const by = second.get(d)
    if (by?.size) {
      notes.push({ type: "returnee", text: "Second Timers Distribution" })
      const lastWeek = sundays[pos.get(d)! - 1]
      for (const [first, n] of [...by].sort((a, b) => b[0].localeCompare(a[0]))) {
        notes.push({ type: "returnee", text: `${n} returned from ${first === lastWeek ? "last week" : shortDate(first, d)}` })
      }
    }
    if (notes.length) out[d] = notes
  }
  return out
}
