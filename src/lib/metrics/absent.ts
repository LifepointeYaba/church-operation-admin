import { prisma } from "@/lib/db"
import { memberStats, servicePoints, type MemberStat } from "@/lib/metrics"

/** Status filter value meaning "every status, including Not Active". The default (empty) hides Not Active. */
export const ALL_STATUSES = "all"

/** The latest Sunday in the most recent attendance upload, used as the Absent Members card's default date. */
export async function lastUploadedSunday(): Promise<string | null> {
  const uploads = await prisma.upload.findMany({
    where: { kind: "attendance", status: { not: "failed" } },
    orderBy: { uploadedAt: "desc" },
    take: 5,
    select: { summary: true },
  })
  for (const u of uploads) {
    const dates = (u.summary as { serviceDates?: unknown } | null)?.serviceDates
    if (Array.isArray(dates)) {
      const latest = dates.filter((d): d is string => typeof d === "string").sort().at(-1)
      if (latest) return latest
    }
  }
  return null
}

export type AbsentMember = MemberStat

/**
 * People whose last visit (as of the stats' reference Sunday) falls between `from` and `to`,
 * and who weren't present on that reference Sunday — i.e. they came in the range, then stopped.
 */
export function absentBetween(stats: MemberStat[], from: string, to: string, statusFilter: string): AbsentMember[] {
  return stats
    .filter((m) => m.lastDate != null && !m.p1 && m.lastDate >= from && m.lastDate <= to)
    .filter((m) => statusFilter ? true : m.status !== "Not Active")
    .sort((a, b) => (a.lastRn! - b.lastRn!) || a.firstName.localeCompare(b.firstName))
}

const ISO = /^\d{4}-\d{2}-\d{2}$/
const addDays = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10)

export type AbsentParams = { abs_from?: string; abs_to?: string; abs_team?: string; abs_status?: string; abs_gender?: string }

/** Turns the card's URL params into valid filters. Shared by the dashboard and the CSV export so they always match. */
export async function absentMembers(sp: AbsentParams, statuses: string[]) {
  const [points, lastUploaded, teams] = await Promise.all([
    servicePoints(), lastUploadedSunday(), prisma.team.findMany({ select: { name: true } }),
  ])
  const takenDates = points.filter((p) => p.recordTaken).map((p) => p.date)
  if (!takenDates.length) return null
  // "Absent" is judged as of the latest Sunday with attendance.
  const asOf = takenDates.at(-1)!
  // From/To filter the "Last came" date. Default: last came in the 3 months before the latest Sunday.
  const isDate = (d?: string | null) => (d && ISO.test(d) && !Number.isNaN(Date.parse(d)) ? d : undefined)
  let from = isDate(sp.abs_from) ?? addDays(asOf, -12 * 7)
  let to = isDate(sp.abs_to) ?? addDays(asOf, -1)
  if (from > to) [from, to] = [to, from]
  const status = sp.abs_status === ALL_STATUSES || statuses.includes(sp.abs_status ?? "") ? sp.abs_status! : ""
  const gender = sp.abs_gender === "Female" || sp.abs_gender === "Male" ? sp.abs_gender : ""
  const team = teams.some((t) => t.name === sp.abs_team) ? sp.abs_team! : ""
  const stats = await memberStats(asOf, {
    team: team || undefined,
    gender: gender || undefined,
    status: status && status !== ALL_STATUSES ? status : undefined,
  })
  return { people: absentBetween(stats, from, to, status), from, to, asOf, team, status, gender, lastUploaded }
}
