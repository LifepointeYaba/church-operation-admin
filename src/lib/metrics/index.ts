import { Prisma } from "@prisma/client"
import { unstable_cache } from "next/cache"
import { prisma } from "../db"
import { getSettings, type AppSettings } from "../settings"
import { isoDate } from "../dates"

export const METRICS_TAG = "metrics"

export type Filters = { status?: string; team?: string; gender?: string }

export type MemberStat = {
  id: number
  firstName: string
  lastName: string
  phone: string | null
  status: string
  gender: string | null
  personResponsible: string | null
  teams: string[]
  visits: number
  /** 1 = present on the reference Sunday, 2 = the Sunday before … null = never. */
  lastRn: number | null
  lastDate: string | null
  firstDate: string | null
  secondDate: string | null
  streak: number
  prevRn: number | null
  /** Date of the visit before the most recent one. */
  prevDate: string | null
  p1: boolean
  p2: boolean
  visits5to16: number
  visits26: number
}

export type Activity = "active" | "at_risk" | "inactive" | "lapsed" | "never"

export type ServicePoint = {
  id: number
  date: string
  recordTaken: boolean
  /** Special-Sunday label ("Flicks & Talks"); null for a regular Sunday. */
  label: string | null
  present: number
  headcount: null | {
    workers: number; members: number; firstTimers: number; secondTimers: number
    male: number; female: number; children: number; guests: number; total: number
  }
}

const d2s = (d: Date | null) => (d ? isoDate(d) : null)

export function filterSql(f: Filters) {
  const parts: Prisma.Sql[] = [Prisma.sql`m.deleted_at IS NULL`]
  if (f.status) parts.push(Prisma.sql`m.status = ${f.status}`)
  if (f.gender) parts.push(Prisma.sql`m.gender = ${f.gender}`)
  if (f.team)
    parts.push(Prisma.sql`EXISTS (SELECT 1 FROM member_teams mt JOIN teams t ON t.id = mt.team_id WHERE mt.member_id = m.id AND t.name = ${f.team})`)
  return Prisma.join(parts, " AND ")
}

/** The latest service with a record taken on or before `date` (defaults to the latest overall). */
export async function referenceService(date?: string | null) {
  return prisma.service.findFirst({
    where: { recordTaken: true, ...(date ? { date: { lte: new Date(`${date}T00:00:00Z`) } } : {}) },
    orderBy: { date: "desc" },
  })
}

async function _memberStats(refIso: string, f: Filters): Promise<MemberStat[]> {
  const ref = new Date(`${refIso}T00:00:00Z`)
  const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
    WITH svc AS (
      SELECT id, date, (ROW_NUMBER() OVER (ORDER BY date DESC))::int AS rn
      FROM services WHERE record_taken AND date <= ${ref}::date
    ),
    pres AS (
      SELECT a.member_id, s.rn, s.date,
        (ROW_NUMBER() OVER (PARTITION BY a.member_id ORDER BY s.rn))::int AS seq,
        (ROW_NUMBER() OVER (PARTITION BY a.member_id ORDER BY s.date))::int AS ord
      FROM attendance a JOIN svc s ON s.id = a.service_id
    ),
    agg AS (
      SELECT member_id,
        COUNT(*)::int AS visits,
        MIN(rn)::int AS last_rn,
        MAX(date) AS last_date,
        MIN(date) AS first_date,
        MAX(date) FILTER (WHERE ord = 2) AS second_date,
        (COUNT(*) FILTER (WHERE rn = seq))::int AS streak,
        (MIN(rn) FILTER (WHERE seq = 2))::int AS prev_rn,
        MAX(date) FILTER (WHERE seq = 2) AS prev_date,
        BOOL_OR(rn = 1) AS p1,
        BOOL_OR(rn = 2) AS p2,
        (COUNT(*) FILTER (WHERE rn BETWEEN 5 AND 16))::int AS visits_5_16,
        (COUNT(*) FILTER (WHERE rn <= 26))::int AS visits_26
      FROM pres GROUP BY member_id
    )
    SELECT m.id, m.first_name, m.last_name, m.phone, m.status, m.gender, m.person_responsible,
      COALESCE((SELECT array_agg(t.name ORDER BY t.name) FROM member_teams mt JOIN teams t ON t.id = mt.team_id
                WHERE mt.member_id = m.id), '{}') AS teams,
      COALESCE(agg.visits, 0) AS visits, agg.last_rn, agg.last_date, agg.first_date, agg.second_date,
      COALESCE(agg.streak, 0) AS streak, agg.prev_rn, agg.prev_date, COALESCE(agg.p1, false) AS p1, COALESCE(agg.p2, false) AS p2,
      COALESCE(agg.visits_5_16, 0) AS visits_5_16, COALESCE(agg.visits_26, 0) AS visits_26
    FROM members m LEFT JOIN agg ON agg.member_id = m.id
    WHERE ${filterSql(f)}
    ORDER BY m.first_name, m.last_name`
  return rows.map((r) => ({
    id: r.id as number,
    firstName: r.first_name as string,
    lastName: r.last_name as string,
    phone: r.phone as string | null,
    status: r.status as string,
    gender: r.gender as string | null,
    personResponsible: r.person_responsible as string | null,
    teams: r.teams as string[],
    visits: r.visits as number,
    lastRn: r.last_rn as number | null,
    lastDate: d2s(r.last_date as Date | null),
    firstDate: d2s(r.first_date as Date | null),
    secondDate: d2s(r.second_date as Date | null),
    streak: r.streak as number,
    prevRn: r.prev_rn as number | null,
    prevDate: d2s(r.prev_date as Date | null),
    p1: r.p1 as boolean,
    p2: r.p2 as boolean,
    visits5to16: r.visits_5_16 as number,
    visits26: r.visits_26 as number,
  }))
}

export const memberStats = unstable_cache(_memberStats, ["member-stats"], { tags: [METRICS_TAG], revalidate: 3600 })

export function activityOf(m: MemberStat, s: AppSettings): Activity {
  if (m.lastRn == null) return "never"
  if (m.lastRn <= s.atRiskWeeks) return "active"
  if (m.visits < s.minVisitsForRisk) return "lapsed"
  if (m.lastRn > s.inactiveWeeks) return "inactive"
  return "at_risk"
}

/** Sundays missed in a row up to the reference Sunday. */
export const missedInARow = (m: MemberStat) => (m.lastRn == null ? null : m.lastRn - 1)

async function _servicePoints(): Promise<ServicePoint[]> {
  const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
    SELECT s.id, s.date, s.record_taken, s.label,
      -- Present = the weekly headcount total when the Sunday has one, so both numbers always agree.
      COALESCE(h.total, (SELECT COUNT(*)::int FROM attendance a JOIN members m ON m.id = a.member_id
        WHERE a.service_id = s.id AND m.deleted_at IS NULL)) AS present,
      h.workers, h.members, h.first_timers, h.second_timers, h.male, h.female, h.children, h.guests, h.total
    FROM services s
    LEFT JOIN service_headcounts h ON h.service_id = s.id AND h.is_current
    ORDER BY s.date`
  return rows.map((r) => ({
    id: r.id as number,
    date: isoDate(r.date as Date),
    recordTaken: r.record_taken as boolean,
    label: (r.label as string | null) || null,
    present: r.present as number,
    headcount:
      r.total == null
        ? null
        : {
            workers: r.workers as number, members: r.members as number,
            firstTimers: r.first_timers as number, secondTimers: r.second_timers as number,
            male: r.male as number, female: r.female as number, children: r.children as number, guests: r.guests as number,
            total: r.total as number,
          },
  }))
}

export const servicePoints = unstable_cache(_servicePoints, ["service-points"], { tags: [METRICS_TAG], revalidate: 3600 })

export type Cohort = { month: string; firstTimers: number; retained: number; settled: number }

async function _cohorts(): Promise<Cohort[]> {
  const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
    WITH firsts AS (
      SELECT a.member_id, MIN(s.date) AS first_date, COUNT(*)::int AS visits
      FROM attendance a JOIN services s ON s.id = a.service_id JOIN members m ON m.id = a.member_id
      WHERE s.record_taken AND m.deleted_at IS NULL
      GROUP BY a.member_id
    )
    SELECT to_char(date_trunc('month', f.first_date), 'YYYY-MM') AS month,
      COUNT(*)::int AS first_timers,
      (COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM attendance a2 JOIN services s2 ON s2.id = a2.service_id
        WHERE a2.member_id = f.member_id AND s2.date > f.first_date AND s2.date <= f.first_date + 56)))::int AS retained,
      (COUNT(*) FILTER (WHERE f.visits >= 4))::int AS settled
    FROM firsts f GROUP BY 1 ORDER BY 1`
  return rows.map((r) => ({
    month: r.month as string,
    firstTimers: r.first_timers as number,
    retained: r.retained as number,
    settled: r.settled as number,
  }))
}

export const cohorts = unstable_cache(_cohorts, ["cohorts"], { tags: [METRICS_TAG], revalidate: 3600 })

export function monthlyAverages(points: ServicePoint[], fromIso?: string) {
  const months = new Map<string, { present: number[]; total: number[] }>()
  for (const p of points) {
    if (!p.recordTaken || (fromIso && p.date < fromIso)) continue
    const k = p.date.slice(0, 7)
    const m = months.get(k) ?? { present: [], total: [] }
    m.present.push(p.present)
    if (p.headcount) m.total.push(p.headcount.total)
    months.set(k, m)
  }
  const avg = (a: number[]) => (a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : null)
  return [...months].map(([month, v]) => ({ month, present: avg(v.present), headcount: avg(v.total), sundays: v.present.length }))
}

export async function teamRates(refIso: string, weeks = 26) {
  const ref = new Date(`${refIso}T00:00:00Z`)
  const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
    WITH svc AS (
      SELECT id FROM services WHERE record_taken AND date <= ${ref}::date ORDER BY date DESC LIMIT ${weeks}
    )
    SELECT t.name,
      COUNT(DISTINCT mt.member_id)::int AS members,
      (SELECT COUNT(*)::int FROM attendance a JOIN member_teams mt2 ON mt2.member_id = a.member_id
        JOIN members m ON m.id = a.member_id
        WHERE mt2.team_id = t.id AND m.deleted_at IS NULL AND a.service_id IN (SELECT id FROM svc)) AS present,
      (SELECT COUNT(*)::int FROM svc) AS sundays
    FROM teams t JOIN member_teams mt ON mt.team_id = t.id JOIN members m ON m.id = mt.member_id AND m.deleted_at IS NULL
    GROUP BY t.id, t.name ORDER BY t.name`
  return rows.map((r) => {
    const members = r.members as number
    const sundays = r.sundays as number
    const present = r.present as number
    return { team: r.name as string, members, rate: members && sundays ? Math.round((present / (members * sundays)) * 100) : 0 }
  })
}

/** Registered present per service for a filtered set of members. */
async function _presentByService(f: Filters) {
  const rows = await prisma.$queryRaw<{ date: Date; present: number }[]>`
    SELECT s.date, (COUNT(a.member_id) FILTER (WHERE ${filterSql(f)}))::int AS present
    FROM services s
    LEFT JOIN attendance a ON a.service_id = s.id
    LEFT JOIN members m ON m.id = a.member_id
    WHERE s.record_taken
    GROUP BY s.date ORDER BY s.date`
  return rows.map((r) => ({ date: isoDate(r.date), present: r.present }))
}
export const presentByService = unstable_cache(_presentByService, ["present-by-service"], { tags: [METRICS_TAG], revalidate: 3600 })

/** Visits per member between two dates (inclusive) — for the "Regular" definition. */
export async function visitsInRange(fromIso: string, toIso: string, f: Filters) {
  const from = new Date(`${fromIso}T00:00:00Z`)
  const to = new Date(`${toIso}T00:00:00Z`)
  const [{ sundays }] = await prisma.$queryRaw<{ sundays: number }[]>`
    SELECT COUNT(*)::int AS sundays FROM services WHERE record_taken AND date BETWEEN ${from}::date AND ${to}::date`
  const rows = await prisma.$queryRaw<{ visits: number }[]>`
    SELECT COUNT(*)::int AS visits FROM attendance a
    JOIN services s ON s.id = a.service_id JOIN members m ON m.id = a.member_id
    WHERE s.record_taken AND s.date BETWEEN ${from}::date AND ${to}::date AND ${filterSql(f)}
    GROUP BY a.member_id`
  return { sundays, attenders: rows.length, regulars: rows.filter((r) => sundays > 0 && r.visits * 2 >= sundays).length }
}

export { getSettings }
