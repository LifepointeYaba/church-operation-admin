import { Activity, CalendarCheck, Repeat, TriangleAlert, UserMinus } from "lucide-react"
import { requireAdmin } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  activityOf, cohorts, memberStats, monthlyAverages, presentByService, referenceService, servicePoints, teamRates, visitsInRange,
  type Filters,
} from "@/lib/metrics"
import { FUNNEL } from "@/lib/metrics/lists"
import { getSettings } from "@/lib/settings"
import { formatDate, isoDate } from "@/lib/dates"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState, PageHeader, StatCard, shortStatus } from "@/components/common"
import { AttendanceChart, CohortChart, HBarChart, HeadcountChart } from "@/components/charts"
import { TrendFilters } from "./filters"

export const metadata = { title: "Trends" }

function rangeDates(range: string, refIso: string, from?: string, to?: string): [string, string] {
  const ref = new Date(`${refIso}T00:00:00Z`)
  const back = (days: number) => isoDate(new Date(ref.getTime() - days * 86400000))
  switch (range) {
    case "sunday": return [refIso, refIso]
    case "month": return [back(27), refIso]
    case "quarter": return [back(90), refIso]
    case "6m": return [back(182), refIso]
    case "12m": return [back(364), refIso]
    case "all": return ["2000-01-01", refIso]
    case "custom": return [from || "2025-01-01", to || refIso]
    default: return ["2025-01-01", refIso]
  }
}

type SP = { range?: string; from?: string; to?: string; status?: string; team?: string; gender?: string }

export default async function TrendsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdmin()
  const sp = await searchParams
  const ref = await referenceService()
  if (!ref) return <EmptyState title="No attendance yet" />
  const refIso = isoDate(ref.date)
  const range = sp.range ?? "2025"
  const [from, to] = rangeDates(range, refIso, sp.from, sp.to)
  const filters: Filters = { status: sp.status || undefined, team: sp.team || undefined, gender: sp.gender || undefined }
  const filtered = !!(filters.status || filters.team || filters.gender)

  const [settings, teams, points, present, cohortRows, stats, teamRows, inRange] = await Promise.all([
    getSettings(),
    prisma.team.findMany({ orderBy: { name: "asc" } }),
    servicePoints(),
    presentByService(filters),
    cohorts(),
    memberStats(refIso, filters),
    teamRates(refIso),
    visitsInRange(from, to, filters),
  ])
  const totals = new Map(points.map((p) => [p.date, p.headcount?.total ?? null]))
  const sundays = present.filter((p) => p.date >= from && p.date <= to).map((p) => ({ ...p, total: filtered ? null : totals.get(p.date) ?? null }))
  const months = monthlyAverages(
    points.filter((p) => p.date >= from && p.date <= to).map((p) => ({ ...p, present: present.find((x) => x.date === p.date)?.present ?? 0, headcount: filtered ? null : p.headcount })),
  )
  const hc = points.filter((p) => p.headcount && p.date >= from && p.date <= to).map((p) => ({ date: p.date, ...p.headcount! }))
  const cohortInRange = cohortRows.filter((c) => `${c.month}-01` >= from.slice(0, 7) + "-01" && `${c.month}-01` <= to)

  const counts = { active: 0, at_risk: 0, inactive: 0 }
  for (const m of stats) {
    const a = activityOf(m, settings)
    if (a in counts) counts[a as keyof typeof counts]++
  }
  const funnel = FUNNEL.map((st) => ({ name: shortStatus(st), value: stats.filter((m) => m.status === st).length }))
  const workers = stats.filter((m) => m.status === "Worker")
  const workerRate = workers.length ? Math.round((workers.reduce((a, m) => a + Math.min(m.visits26, 26), 0) / (workers.length * 26)) * 100) : 0

  return (
    <div className="stagger space-y-4">
      <PageHeader title="Trends" description={`${formatDate(from === "2000-01-01" ? points[0]?.date ?? from : from, "long")} – ${formatDate(to, "long")} · ${inRange.sundays} Sundays with a record`} />
      <TrendFilters statuses={settings.statuses} teams={teams.map((t) => t.name)} range={range} from={from} to={to} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Active now" value={counts.active} icon={Activity} tone="good" />
        <StatCard label="At risk" value={counts.at_risk} icon={TriangleAlert} tone="amber" />
        <StatCard label="Inactive" value={counts.inactive} icon={UserMinus} tone="blue" />
        <StatCard label="Attended in range" value={inRange.attenders} icon={CalendarCheck} tone="blue" />
        <StatCard label="Regulars in range" value={inRange.regulars} icon={Repeat} tone="green" hint="Came to at least half the Sundays" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Attendance</CardTitle>
          <CardDescription>{filtered ? "Registered present for the filtered group (headcount is church-wide, so it is hidden while filtering)." : "Registered present with the weekly headcount total."}</CardDescription>
        </CardHeader>
        <CardContent><AttendanceChart sundays={sundays} months={months} defaultFrom={from} allowHistory={false} /></CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Headcount split</CardTitle><CardDescription>Each Sunday, from the weekly headcount.</CardDescription></CardHeader>
          <CardContent>{hc.length ? <HeadcountChart points={hc} /> : <EmptyState title="No headcounts in this range" />}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>First-timer retention</CardTitle><CardDescription>By month of first visit.</CardDescription></CardHeader>
          <CardContent>{cohortInRange.length ? <CohortChart rows={cohortInRange} /> : <EmptyState title="No first visits in this range" />}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Status journey</CardTitle><CardDescription>People at each stage, First Timer → Worker.</CardDescription></CardHeader>
          <CardContent><HBarChart data={funnel} valueLabel="People" /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Attendance rate by team</CardTitle><CardDescription>Share of the last 26 Sundays attended. Workers overall: {workerRate}%.</CardDescription></CardHeader>
          <CardContent><HBarChart data={teamRows.map((t) => ({ name: t.team, value: t.rate, note: `${t.members} people` }))} unit="%" valueLabel="Attendance rate" /></CardContent>
        </Card>
      </div>
    </div>
  )
}
