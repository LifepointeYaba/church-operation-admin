import { unstable_cache } from "next/cache"
import { prisma } from "../db"
import { isoDate } from "../dates"
import { METRICS_TAG, filterSql, type Filters } from "./index"

/** The weekly "Chart" numbers, one per Sunday. `children` is null when it can't be known (register has no ages). */
export type Breakdown = {
  workers: number; members: number; firstTimers: number; secondTimers: number
  total: number; male: number; female: number; children: number | null
}

export const BREAKDOWN_ROWS: { key: keyof Breakdown; label: string; strong?: boolean }[] = [
  { key: "workers", label: "Workers" },
  { key: "members", label: "Members" },
  { key: "firstTimers", label: "First Timers" },
  { key: "secondTimers", label: "Second Timers" },
  { key: "total", label: "Total Number", strong: true },
  { key: "male", label: "Male" },
  { key: "female", label: "Female" },
  { key: "children", label: "Children" },
]

/**
 * The same breakdown worked out from the attendance register, so it can be filtered by team and gender.
 * Workers = status Worker (always); first/second timers = anyone else on their first/second recorded visit; members = everyone else present.
 */
async function _registerBreakdown(fromIso: string, toIso: string, f: Filters): Promise<Record<string, Breakdown>> {
  const from = new Date(`${fromIso}T00:00:00Z`)
  const to = new Date(`${toIso}T00:00:00Z`)
  const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
    WITH visits AS (
      SELECT a.member_id, s.date,
        (ROW_NUMBER() OVER (PARTITION BY a.member_id ORDER BY s.date))::int AS ord
      FROM attendance a JOIN services s ON s.id = a.service_id
      WHERE s.record_taken AND s.date <= ${to}::date
    )
    SELECT v.date,
      COUNT(*)::int AS total,
      (COUNT(*) FILTER (WHERE m.status = 'Worker'))::int AS workers,
      (COUNT(*) FILTER (WHERE v.ord = 1 AND m.status IS DISTINCT FROM 'Worker'))::int AS first_timers,
      (COUNT(*) FILTER (WHERE v.ord = 2 AND m.status IS DISTINCT FROM 'Worker'))::int AS second_timers,
      (COUNT(*) FILTER (WHERE m.gender = 'Male'))::int AS male,
      (COUNT(*) FILTER (WHERE m.gender = 'Female'))::int AS female
    FROM visits v JOIN members m ON m.id = v.member_id
    WHERE v.date >= ${from}::date AND ${filterSql(f)}
    GROUP BY v.date`
  return Object.fromEntries(
    rows.map((r) => {
      const total = r.total as number
      const workers = r.workers as number
      const firstTimers = r.first_timers as number
      const secondTimers = r.second_timers as number
      return [isoDate(r.date as Date), {
        workers, firstTimers, secondTimers, total,
        members: total - workers - firstTimers - secondTimers,
        male: r.male as number, female: r.female as number, children: null,
      }]
    }),
  )
}

/** Uncached version, for writes that need numbers straight after an import. */
export const registerBreakdownNow = _registerBreakdown

export const registerBreakdown = unstable_cache(_registerBreakdown, ["register-breakdown"], { tags: [METRICS_TAG], revalidate: 3600 })

export async function notesBetween(fromIso: string, toIso: string) {
  const notes = await prisma.serviceNote.findMany({
    where: { service: { date: { gte: new Date(`${fromIso}T00:00:00Z`), lte: new Date(`${toIso}T00:00:00Z`) } } },
    include: { service: { select: { date: true } } },
    orderBy: [{ serviceId: "asc" }, { id: "asc" }],
  })
  const by: Record<string, { type: string; text: string }[]> = {}
  for (const n of notes) (by[isoDate(n.service.date)] ??= []).push({ type: n.type, text: n.text })
  return by
}
