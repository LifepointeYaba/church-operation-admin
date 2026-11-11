import Link from "next/link"
import { NavLink } from "@/components/navigation"
import { Activity, CalendarCheck, TriangleAlert, UserPlus } from "lucide-react"
import { requirePermission } from "@/lib/auth"
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
import { ParamSelect } from "@/components/param-select"
import { AttendanceChart } from "@/components/charts"
import { SundayNumbers } from "./sunday-numbers"
import { MISSED_OPTIONS } from "./absent-workers"
import { ALL_STATUSES, AbsentMembers, absentOn, lastUploadedSunday } from "./absent-members"

export const metadata = { title: "Dashboard" }

function greeting() {
  const h = (new Date().getUTCHours() + 1) % 24 // Lagos is UTC+1
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"
}

type SP = {
  date?: string; team?: string; gender?: string; source?: string; missed?: string
  abs_date?: string; abs_team?: string; abs_status?: string; abs_gender?: string
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requirePermission("dashboard.view")
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
  // Unfiltered, "present" is the weekly headcount total (same number as on the headcount page).
  const presentNow = filtered ? s.present : taken[idx].present
  const presentPrev = filtered ? p?.present : idx > 0 ? taken[idx - 1].present : null
  const lists = callLists(stats, refIso, settings)
  const prevLists = prevStats && prevIso ? callLists(prevStats, prevIso, settings) : null
  const point = taken[idx]
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
  const zero = { workers: 0, members: 0, firstTimers: 0, secondTimers: 0, total: 0, male: 0, female: 0, children: null, guests: null }
  const columns = monthPoints.map((pt) => ({
    date: pt.date,
    values: register ? (pt.recordTaken ? register[pt.date] ?? zero : null) : pt.headcount,
    present: pt.recordTaken ? pt.present : null,
    notes: notes[pt.date] ?? [],
    label: pt.label,
    hasService: true,
  }))
  const prevMonthDate = taken.filter((t) => t.date < `${month}-01`).at(-1)?.date ?? null
  const laterMonth = taken.find((t) => t.date.slice(0, 7) > month)?.date.slice(0, 7)
  const nextMonthDate = laterMonth ? taken.filter((t) => t.date.startsWith(laterMonth)).at(-1)!.date : null

  const missed = MISSED_OPTIONS.includes(Number(sp.missed)) ? Number(sp.missed) : settings.workerMissWeeks
  const absentWorkers = stats
    .filter((m) => m.status === "Worker" && (m.lastRn == null || m.lastRn > missed))
    .sort((a, b) => (a.lastDate ?? "").localeCompare(b.lastDate ?? ""))

  // "Who didn't come" card: its own filters, defaulting to the latest Sunday in the last upload.
  const takenDates = taken.map((t) => t.date)
  const lastUploaded = await lastUploadedSunday()
  const absDate = [sp.abs_date, lastUploaded].find((d) => d && takenDates.includes(d)) ?? takenDates.at(-1)!
  const absStatus = sp.abs_status === ALL_STATUSES || settings.statuses.includes(sp.abs_status ?? "") ? sp.abs_status! : ""
  const absGender = sp.abs_gender === "Female" || sp.abs_gender === "Male" ? sp.abs_gender : ""
  const absTeam = teams.some((t) => t.name === sp.abs_team) ? sp.abs_team! : ""
  const absentMembers = absentOn(
    await memberStats(absDate, {
      team: absTeam || undefined,
      gender: absGender || undefined,
      status: absStatus && absStatus !== ALL_STATUSES ? absStatus : undefined,
    }),
    absStatus,
  )

  const chartSundays = (filteredPresent ?? taken)
    .filter((t) => t.date <= refIso)
    .map((t) => ({ date: t.date, present: t.present, total: filtered ? null : taken.find((x) => x.date === t.date)?.headcount?.total ?? null }))
  const chartMonths = filteredPresent
    ? monthlyAverages(taken.filter((t) => t.date <= refIso).map((t) => ({ ...t, headcount: null, present: filteredPresent.find((x) => x.date === t.date)?.present ?? 0 })))
    : monthlyAverages(taken.filter((t) => t.date <= refIso))

  return (
    <div className="stagger space-y-5">
      <section className="leaf-corner relative overflow-hidden bg-[#c2410c] p-5 text-white md:p-7">
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[13px] font-bold tracking-[0.06em] uppercase">{greeting()}</p>
            <h2 className="mt-1 text-[28px] leading-[34px] font-bold md:text-[40px] md:leading-[46px] md:tracking-[-0.015em]">Sunday {formatDate(refIso, "long")}</h2>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              {point.label && <span className="rounded-full bg-white px-3 py-1 font-semibold text-[#c2410c]">{point.label}</span>}
              <span className="rounded-full bg-white/20 px-3 py-1 font-semibold">{point.present} present</span>
              {!point.headcount && <span className="rounded-full bg-white/10 px-3 py-1 font-semibold">No headcount yet</span>}
              {s.streak3 > 0 && <span className="rounded-full bg-white/20 px-3 py-1 font-semibold">{s.streak3} on a 3+ week streak</span>}
            </div>
          </div>
          <Button asChild size="lg" className="h-11 rounded-full bg-white px-6 text-base text-[#c2410c] hover:bg-white/90">
            <Link href="/attendance"><CalendarCheck className="size-4" /> Mark attendance</Link>
          </Button>
        </div>
      </section>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2" role="group" aria-label="Filters">
        <span className="hidden px-2 text-sm font-medium text-muted-foreground sm:inline">Filter</span>
        <ParamSelect className="h-9 min-w-0 flex-1 rounded-full px-4 sm:flex-none" name="date" label="Sunday" value={refIso} options={[...taken].reverse().map((t) => ({ value: t.date, label: formatDate(t.date, "long") }))} />
        <ParamSelect className="h-9 min-w-0 flex-1 rounded-full px-4 sm:flex-none" name="team" label="Team" value={sp.team ?? ""} options={[{ value: "", label: "All teams" }, ...teams.map((t) => ({ value: t.name, label: t.name }))]} />
        <ParamSelect className="h-9 min-w-0 flex-1 rounded-full px-4 sm:flex-none" name="gender" label="Gender" value={sp.gender ?? ""} options={[{ value: "", label: "Any gender" }, { value: "Female", label: "Female" }, { value: "Male", label: "Male" }]} />
        {filtered && <Button variant="ghost" size="sm" asChild><NavLink href={hrefWith({ team: undefined, gender: undefined })}>Clear filters</NavLink></Button>}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Present this Sunday" value={presentNow} delta={d(presentNow, presentPrev)} icon={CalendarCheck} tone="blue" />
        <StatCard label="Active" value={s.active} delta={d(s.active, p?.active)} icon={Activity} tone="good" hint={`Came to ≥1 of last ${settings.atRiskWeeks}`} />
        <StatCard label="At risk" value={s.at_risk} delta={d(s.at_risk, p?.at_risk)} icon={TriangleAlert} tone="amber" lowerIsBetter hint={`Missed ${settings.atRiskWeeks}–${settings.inactiveWeeks - 1} in a row`} />
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
              <div className="inline-flex rounded-full border bg-card p-0.5 text-sm" role="group" aria-label="Source">
                {(["headcount", "register"] as const).map((src) => (
                  <NavLink key={src} href={hrefWith({ source: src === "register" ? "register" : undefined })}
                    aria-current={source === src}
                    className={cn("rounded-full px-3 py-1 font-semibold", source === src ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                    {src === "headcount" ? "Headcount" : "Register"}
                  </NavLink>
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
      <Card id="absent-members">
        <CardHeader>
          <CardTitle>Absent Members ({absentMembers.length})</CardTitle>
          <CardDescription>
            People not marked present on {formatDate(absDate, "long")}{absDate === lastUploaded ? " (last uploaded Sunday)" : ""}. Only people who had started attending by then are listed. These filters only affect this card.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AbsentMembers
            people={absentMembers} date={absDate} dates={[...takenDates].reverse()}
            team={absTeam} teams={teams.map((t) => t.name)}
            status={absStatus} statuses={settings.statuses} gender={absGender}
          />
        </CardContent>
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
    </div>
  )
}
