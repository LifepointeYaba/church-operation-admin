import Link from "next/link"
import { Activity, CalendarCheck, ChevronDown, ClipboardCheck, ClipboardList, Flame, PhoneCall, TrendingDown, TriangleAlert, UserCheck, UserMinus, UserPlus, type LucideIcon } from "lucide-react"
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
import { EmptyState, PageHeader } from "@/components/common"
import { CountUp } from "@/components/count-up"
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

  const sundayNotes = notes[refIso] ?? []
  const followUps: { key: string; title: string; hint: string; people: typeof s.returnees; icon: LucideIcon; tone: "call" | "watch" | "good"; extra?: (m: (typeof s.returnees)[number]) => string; action?: React.ReactNode }[] = [
    { key: "last-not-this", title: "Came last Sunday, not this one", hint: prevPoint ? `Present ${formatDate(prevPoint.date, "long")}` : "", people: s.cameLastNotThis, icon: UserMinus, tone: "call" },
    { key: "at-risk", title: "Newly at risk", hint: `Missed ${settings.atRiskWeeks} in a row after ${settings.minVisitsForRisk}+ visits`, people: lists.newlyAtRisk, icon: TriangleAlert, tone: "call" },
    { key: "slipping", title: "Regulars slipping away", hint: `Came 3+ times, absent the last ${settings.atRiskWeeks}`, people: lists.slippingRegulars, icon: TrendingDown, tone: "call" },
    { key: "review", title: "Status needs review", hint: `Marked Not Active but attended recently`, people: s.mismatches, icon: ClipboardCheck, tone: "watch",
      action: <Button variant="outline" size="sm" className="mt-3" asChild><Link href="/call-lists#review">Review suggestions</Link></Button> },
    { key: "this-not-last", title: "Here this Sunday, not last", hint: "Welcome them back", people: s.cameThisNotLast, icon: UserCheck, tone: "good" },
    { key: "streaks", title: "Streaks of 3+", hint: "Came three or more Sundays in a row", people: s.streaks, icon: Flame, tone: "good", extra: (m) => `${m.streak} in a row` },
  ]
  const TONE = {
    call: { dot: "bg-primary", label: "Needs calls" },
    watch: { dot: "bg-warning", label: "Review" },
    good: { dot: "bg-bark", label: "Celebrate" },
  } as const
  const feed = [
    ...lists.firstTimers.map((m) => ({ m, what: "First time at LifePointe" })),
    ...s.returnees.map((m) => ({ m, what: `Back after ${m.prevRn! - 2} Sundays away` })),
  ]

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="stagger min-w-0 space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-[28px] leading-[34px] font-bold">{greeting()}</h2>
            <p className="mt-1 text-muted-foreground">
              Here’s how Sunday {formatDate(refIso, "long")} went.{" "}
              {point.headcount && !filtered ? `${point.headcount.total} in the room, ${point.present} on the register.` : `${point.present} on the register.`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ParamSelect className="h-10 min-w-0 rounded-full bg-card px-4" name="date" label="Sunday" value={refIso} options={[...taken].reverse().map((t) => ({ value: t.date, label: formatDate(t.date, "long") }))} />
            <Button asChild className="h-10 rounded-full px-5">
              <Link href="/attendance"><CalendarCheck className="size-4" /> Mark attendance</Link>
            </Button>
          </div>
        </header>

        <section aria-label="This Sunday at a glance" className="grid grid-cols-2 gap-y-5 border-y py-5 lg:grid-cols-4 lg:divide-x">
          <Stat label="Present" value={s.present} delta={d(s.present, p?.present)} icon={CalendarCheck} />
          <Stat label="Active" value={s.active} delta={d(s.active, p?.active)} icon={Activity} />
          <Stat label="At risk" value={s.at_risk} delta={d(s.at_risk, p?.at_risk)} icon={TriangleAlert} lowerIsBetter />
          <Stat label="First timers" value={lists.firstTimers.length} delta={d(lists.firstTimers.length, prevLists?.firstTimers.length)} icon={UserPlus} />
        </section>

        <section aria-labelledby="att-h">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 id="att-h" className="text-xl font-bold">Attendance</h3>
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
              <ParamSelect className="h-9 min-w-0 rounded-full bg-card px-3 text-sm" name="team" label="Team" value={sp.team ?? ""} options={[{ value: "", label: "All teams" }, ...teams.map((t) => ({ value: t.name, label: t.name }))]} />
              <ParamSelect className="h-9 min-w-0 rounded-full bg-card px-3 text-sm" name="gender" label="Gender" value={sp.gender ?? ""} options={[{ value: "", label: "Any gender" }, { value: "Female", label: "Female" }, { value: "Male", label: "Male" }]} />
              {filtered && <Button variant="ghost" size="sm" asChild><Link href={hrefWith({ team: undefined, gender: undefined })} scroll={false}>Clear</Link></Button>}
            </div>
          </div>
          <AttendanceChart sundays={chartSundays} months={chartMonths} />
        </section>

        <section aria-labelledby="fu-h">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <h3 id="fu-h" className="text-xl font-bold">Follow-ups</h3>
              <span className="border-l pl-3 text-sm font-semibold text-muted-foreground">{followUps.filter((f) => f.tone === "call").reduce((n, f) => n + f.people.length, 0)} people to call</span>
            </div>
            <Button variant="ghost" size="sm" asChild><Link href="/call-lists">Open call lists</Link></Button>
          </div>
          <ul className="divide-y">
            {followUps.map((f) => (
              <li key={f.key}>
                <details className="group">
                  <summary className="grid cursor-pointer list-none grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-1 py-3 hover:bg-muted/60 sm:grid-cols-[40px_minmax(0,1fr)_120px_56px_24px] [&::-webkit-details-marker]:hidden">
                    <span className={cn("flex size-10 items-center justify-center rounded-full", f.tone === "call" ? "bg-primary-soft text-primary" : f.tone === "watch" ? "bg-warning-soft text-warning" : "bg-muted text-bark")}>
                      <f.icon className="size-[18px]" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{f.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{f.hint}</span>
                    </span>
                    <span className="hidden items-center gap-2 text-sm font-semibold sm:flex">
                      <span className={cn("size-2 rounded-full", TONE[f.tone].dot)} aria-hidden />{TONE[f.tone].label}
                    </span>
                    <span className="text-right font-display text-lg font-bold tabular-nums">{f.people.length}</span>
                    <ChevronDown className="hidden size-4 text-muted-foreground transition-transform group-open:rotate-180 sm:block" aria-hidden />
                  </summary>
                  <div className="pb-4 pl-[52px]">
                    <PersonList people={f.people} extra={f.extra} />
                    {f.people.length > 0 && f.action}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>

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

      </div>

      <aside className="space-y-6 xl:sticky xl:top-20 xl:self-start">
        <section className="rounded-2xl bg-muted p-6 text-center" aria-label="This Sunday">
          <p className="text-[13px] font-bold tracking-[0.06em] text-muted-foreground uppercase">This Sunday</p>
          <p className="mt-2 font-display text-5xl font-bold tabular-nums">{point.headcount && !filtered ? point.headcount.total : point.present}</p>
          <p className="mt-1 text-sm text-muted-foreground">{point.headcount && !filtered ? "in the room (headcount)" : "on the register"}</p>
          <div className="mt-5 flex justify-center gap-3">
            {[
              { href: "/attendance", label: "Mark attendance", icon: CalendarCheck },
              { href: "/headcount", label: "Weekly headcount", icon: ClipboardList },
              { href: "/call-lists", label: "Call lists", icon: PhoneCall },
            ].map((a) => (
              <Link key={a.href} href={a.href} aria-label={a.label} title={a.label}
                className="flex size-11 items-center justify-center rounded-full bg-card text-foreground shadow-sm transition-colors hover:bg-primary hover:text-primary-foreground">
                <a.icon className="size-[18px]" aria-hidden />
              </Link>
            ))}
          </div>
        </section>

        <section aria-labelledby="feed-h">
          <h3 id="feed-h" className="border-b pb-3 text-center text-base font-bold">New faces</h3>
          {feed.length === 0 && sundayNotes.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No first timers or returnees this Sunday.</p>}
          <ul className="space-y-5 pt-5">
            {feed.slice(0, 8).map(({ m, what }) => (
              <li key={m.id} className="flex gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary" aria-hidden>
                  {m.firstName[0]}{m.lastName[0] ?? ""}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <Link href={`/members/${m.id}`} className="truncate font-semibold hover:underline">{m.firstName} {m.lastName}</Link>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDate(refIso)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{what}{m.teams.length ? <> · <span className="text-primary">{m.teams[0]}</span></> : null}</p>
                </div>
              </li>
            ))}
            {feed.length > 8 && <li className="text-center text-xs text-muted-foreground">+{feed.length - 8} more on <Link href="/call-lists" className="underline">Call lists</Link></li>}
          </ul>
          {sundayNotes.length > 0 && (
            <div className="mt-6 space-y-2">
              <p className="text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase">Notes from the day</p>
              {sundayNotes.map((n, i) => (
                <p key={i} className="rounded-2xl rounded-tl-sm bg-primary-soft px-4 py-3 text-sm">{n.text}</p>
              ))}
            </div>
          )}
        </section>
      </aside>
    </div>
  )
}

function Stat({ label, value, delta, icon: Icon, lowerIsBetter }: { label: string; value: number; delta: number | null; icon: LucideIcon; lowerIsBetter?: boolean }) {
  const good = delta != null && delta !== 0 && (delta > 0) !== !!lowerIsBetter
  return (
    <div className="flex items-center gap-3 px-1 lg:px-5 lg:first:pl-0">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-foreground"><Icon className="size-5" aria-hidden /></span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-muted-foreground">{label}</p>
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-display text-2xl font-bold tabular-nums"><CountUp value={value} /></span>
          {delta != null && (
            <span className={cn("text-xs font-bold whitespace-nowrap tabular-nums", delta === 0 ? "text-muted-foreground" : good ? "text-primary" : "text-destructive")}>
              {delta > 0 ? "▲" : delta < 0 ? "▼" : "•"} {delta > 0 ? "+" : ""}{delta}<span className="sr-only"> vs last Sunday</span>
            </span>
          )}
        </p>
      </div>
    </div>
  )
}
