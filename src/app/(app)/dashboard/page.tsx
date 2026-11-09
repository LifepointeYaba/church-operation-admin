import Link from "next/link"
import { Activity, CalendarCheck, TriangleAlert, UserPlus } from "lucide-react"
import { requireAdmin } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { memberStats, monthlyAverages, presentByService, referenceService, servicePoints, type Filters } from "@/lib/metrics"
import { notesBetween, registerBreakdown } from "@/lib/metrics/breakdown"
import { callLists, summarize } from "@/lib/metrics/lists"
import { getSettings } from "@/lib/settings"
import { formatDate, isoDate } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { EmptyState, PageHeader, StatCard } from "@/components/common"
import { PersonList } from "@/components/person-list"
import { ParamSelect } from "@/components/param-select"
import { AttendanceChart } from "@/components/charts"
import { SundayNumbers } from "./sunday-numbers"
import { AbsentWorkers, MISSED_OPTIONS } from "./absent-workers"

export const metadata = { title: "Dashboard" }

function greeting() {
  const h = (new Date().getUTCHours() + 1) % 24 // Lagos is UTC+1
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"
}

type SP = { date?: string; team?: string; gender?: string; source?: string; missed?: string }

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdmin()
  const sp = await searchParams
  const ref = await referenceService(sp.date)
  if (!ref) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <EmptyState title="No attendance yet">Import the attendance file on <Link className="underline" href="/uploads">Uploads & import</Link> to get started.</EmptyState>
      </>
    )
  }
  const refIso = isoDate(ref.date)
  const filters: Filters = { team: sp.team || undefined, gender: sp.gender || undefined }
  const filtered = !!(filters.team || filters.gender)
  const [points, settings, teams] = await Promise.all([
    servicePoints(), getSettings(), prisma.team.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
  ])
  const taken = points.filter((p) => p.recordTaken)
  const idx = taken.findIndex((p) => p.date === refIso)
  const prevIso = idx > 0 ? taken[idx - 1].date : null
  const [stats, prevStats, filteredPresent] = await Promise.all([
    memberStats(refIso, filters),
    prevIso ? memberStats(prevIso, filters) : Promise.resolve(null),
    filtered ? presentByService(filters) : Promise.resolve(null),
  ])
  const s = summarize(stats, settings)
  const p = prevStats ? summarize(prevStats, settings) : null
  const lists = callLists(stats, refIso, settings)
  const prevLists = prevStats && prevIso ? callLists(prevStats, prevIso, settings) : null
  const point = taken[idx]
  const prevPoint = idx > 0 ? taken[idx - 1] : null
  const d = (a: number, b: number | undefined | null) => (b == null ? null : a - b)

  // Links keep the current filters.
  const hrefWith = (patch: Partial<SP>) => {
    const q = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][])
    return `?${q}`
  }

  // Sunday numbers for the selected Sunday's month, in the Chart sheet layout.
  const month = refIso.slice(0, 7)
  const monthPoints = points.filter((pt) => pt.date.startsWith(month))
  const source = filtered || sp.source === "register" ? "register" : "headcount"
  const [register, notes] = await Promise.all([
    source === "register" ? registerBreakdown(monthPoints[0].date, monthPoints.at(-1)!.date, filters) : Promise.resolve(null),
    notesBetween(monthPoints[0].date, monthPoints.at(-1)!.date),
  ])
  const zero = { workers: 0, members: 0, firstTimers: 0, secondTimers: 0, total: 0, male: 0, female: 0, children: null }
  const columns = monthPoints.map((pt) => ({
    date: pt.date,
    values: register ? (pt.recordTaken ? register[pt.date] ?? zero : null) : pt.headcount,
    present: pt.recordTaken ? pt.present : null,
    notes: notes[pt.date] ?? [],
  }))
  const prevMonthDate = taken.filter((t) => t.date < `${month}-01`).at(-1)?.date ?? null
  const laterMonth = taken.find((t) => t.date.slice(0, 7) > month)?.date.slice(0, 7)
  const nextMonthDate = laterMonth ? taken.filter((t) => t.date.startsWith(laterMonth)).at(-1)!.date : null

  const missed = MISSED_OPTIONS.includes(Number(sp.missed)) ? Number(sp.missed) : settings.workerMissWeeks
  const absentWorkers = stats
    .filter((m) => m.status === "Worker" && (m.lastRn == null || m.lastRn > missed))
    .sort((a, b) => (a.lastDate ?? "").localeCompare(b.lastDate ?? ""))

  const chartSundays = (filteredPresent ?? taken)
    .filter((t) => t.date <= refIso)
    .map((t) => ({ date: t.date, present: t.present, total: filtered ? null : taken.find((x) => x.date === t.date)?.headcount?.total ?? null }))
  const chartMonths = filteredPresent
    ? monthlyAverages(taken.filter((t) => t.date <= refIso).map((t) => ({ ...t, headcount: null, present: filteredPresent.find((x) => x.date === t.date)?.present ?? 0 })))
    : monthlyAverages(taken.filter((t) => t.date <= refIso))

  return (
    <div className="stagger space-y-5">
      <section className="leaf-corner relative overflow-hidden bg-leaf p-5 text-on-leaf md:p-7">
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[13px] font-bold tracking-[0.06em] uppercase">{greeting()}</p>
            <h2 className="mt-1 text-[28px] leading-[34px] font-bold md:text-[40px] md:leading-[46px] md:tracking-[-0.015em]">Sunday {formatDate(refIso, "long")}</h2>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-white/55 px-3 py-1 font-semibold dark:bg-black/15">{point.present} marked present</span>
              {point.headcount
                ? <span className="rounded-full bg-white/55 px-3 py-1 font-semibold dark:bg-black/15">Headcount {point.headcount.total}</span>
                : <span className="rounded-full bg-white/40 px-3 py-1 font-semibold dark:bg-black/10">No headcount yet</span>}
              {s.streak3 > 0 && <span className="rounded-full bg-white/55 px-3 py-1 font-semibold dark:bg-black/15">{s.streak3} on a 3+ week streak</span>}
            </div>
          </div>
          <Button asChild size="lg" className="h-11 rounded-xl px-6 text-base">
            <Link href="/attendance"><CalendarCheck className="size-4" /> Mark attendance</Link>
          </Button>
        </div>
      </section>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2" role="group" aria-label="Filters">
        <span className="hidden px-2 text-sm font-medium text-muted-foreground sm:inline">Filter</span>
        <ParamSelect className="min-w-0 flex-1 sm:flex-none" name="date" label="Sunday" value={refIso} options={[...taken].reverse().map((t) => ({ value: t.date, label: formatDate(t.date, "long") }))} />
        <ParamSelect className="min-w-0 flex-1 sm:flex-none" name="team" label="Team" value={sp.team ?? ""} options={[{ value: "", label: "All teams" }, ...teams.map((t) => ({ value: t.name, label: t.name }))]} />
        <ParamSelect className="min-w-0 flex-1 sm:flex-none" name="gender" label="Gender" value={sp.gender ?? ""} options={[{ value: "", label: "Any gender" }, { value: "Female", label: "Female" }, { value: "Male", label: "Male" }]} />
        {filtered && <Button variant="ghost" size="sm" asChild><Link href={hrefWith({ team: undefined, gender: undefined })} scroll={false}>Clear filters</Link></Button>}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Present this Sunday" value={s.present} delta={d(s.present, p?.present)} icon={CalendarCheck} tone="blue" hint={point.headcount && !filtered ? `Headcount ${point.headcount.total}` : undefined} />
        <StatCard label="Active" value={s.active} delta={d(s.active, p?.active)} icon={Activity} tone="green" hint={`Came to ≥1 of last ${settings.atRiskWeeks}`} />
        <StatCard label="At risk" value={s.at_risk} delta={d(s.at_risk, p?.at_risk)} icon={TriangleAlert} tone="amber" hint={`Missed ${settings.atRiskWeeks}–${settings.inactiveWeeks - 1} in a row`} />
        <StatCard label="First timers" value={lists.firstTimers.length} delta={d(lists.firstTimers.length, prevLists?.firstTimers.length)} icon={UserPlus} tone="violet" hint={point.headcount && !filtered ? `Headcount: ${point.headcount.firstTimers}` : undefined} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sunday numbers</CardTitle>
          <CardDescription>
            {source === "headcount"
              ? "As counted on the day (weekly headcount)."
              : filtered
                ? "From the attendance register — the headcount is a whole-church count, so it can’t be split by team or gender. Children aren’t tracked in the register."
                : "From the attendance register. Children aren’t tracked in the register."}
          </CardDescription>
          {!filtered && (
            <CardAction>
              <div className="inline-flex rounded-md border p-0.5 text-sm" role="group" aria-label="Source">
                {(["headcount", "register"] as const).map((src) => (
                  <Link key={src} href={hrefWith({ source: src === "register" ? "register" : undefined })} scroll={false}
                    aria-current={source === src}
                    className={cn("rounded px-2.5 py-1", source === src ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                    {src === "headcount" ? "Headcount" : "Register"}
                  </Link>
                ))}
              </div>
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          <SundayNumbers
            month={month} columns={columns} selected={refIso} source={source}
            prevHref={prevMonthDate ? hrefWith({ date: prevMonthDate }) : null}
            nextHref={nextMonthDate ? hrefWith({ date: nextMonthDate }) : null}
            hrefFor={(date) => hrefWith({ date })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Absent workers ({absentWorkers.length})</CardTitle>
          <CardDescription>Workers{filters.team ? ` in ${filters.team}` : ""} who {missed === 1 ? "weren’t here" : `missed ${missed}+ Sundays in a row`} as of {formatDate(refIso, "long")}.</CardDescription>
        </CardHeader>
        <CardContent><AbsentWorkers workers={absentWorkers} missed={missed} /></CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Attendance over time</CardTitle>
          <CardDescription>{filtered ? "Registered people marked present (filtered)." : "Registered people marked present, with the weekly headcount total."}</CardDescription>
        </CardHeader>
        <CardContent>
          <AttendanceChart
            sundays={chartSundays}
            months={chartMonths}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lift-children">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Came last Sunday, not this one ({s.cameLastNotThis.length})</CardTitle>
            <CardDescription>{prevPoint ? `Present ${formatDate(prevPoint.date, "long")}` : ""}</CardDescription>
          </CardHeader>
          <CardContent><PersonList people={s.cameLastNotThis} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Here this Sunday, not last ({s.cameThisNotLast.length})</CardTitle></CardHeader>
          <CardContent><PersonList people={s.cameThisNotLast} /></CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Newly at risk ({lists.newlyAtRisk.length})</CardTitle>
            <CardDescription>Just missed {settings.atRiskWeeks} in a row after {settings.minVisitsForRisk}+ visits.</CardDescription>
          </CardHeader>
          <CardContent><PersonList people={lists.newlyAtRisk} empty="No one newly at risk" /></CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Regulars slipping away ({lists.slippingRegulars.length})</CardTitle>
            <CardDescription>Came 3+ times in the 12 weeks before, absent all of the last {settings.atRiskWeeks}.</CardDescription>
          </CardHeader>
          <CardContent><PersonList people={lists.slippingRegulars} /></CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status needs review ({s.mismatches.length})</CardTitle>
            <CardDescription>Marked “Not Active” but attended in the last {settings.atRiskWeeks} Sundays.</CardDescription>
          </CardHeader>
          <CardContent>
            <PersonList people={s.mismatches} />
            {s.mismatches.length > 0 && <Button variant="outline" size="sm" className="mt-3" asChild><Link href="/call-lists#review">Review suggestions</Link></Button>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Streaks of 3+ ({s.streak3})</CardTitle></CardHeader>
          <CardContent><PersonList people={s.streaks} extra={(m) => `${m.streak} in a row`} /></CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Returnees ({s.returnees.length})</CardTitle>
            <CardDescription>Back after missing {settings.inactiveWeeks}+ Sundays.</CardDescription>
          </CardHeader>
          <CardContent><PersonList people={s.returnees} extra={(m) => `Last seen ${m.prevDate ? formatDate(m.prevDate) : "—"} · away ${m.prevRn! - 2}`} empty="No returnees this Sunday" /></CardContent>
        </Card>
      </div>
    </div>
  )
}
