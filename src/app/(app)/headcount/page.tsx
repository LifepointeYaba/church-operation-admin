import Link from "next/link"
import { NavLink } from "@/components/navigation"
import { requirePermission } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { formatDate, isoDate, lastSunday } from "@/lib/dates"
import { registerBreakdown } from "@/lib/metrics/breakdown"
import { followsRegister } from "@/lib/headcount-sync"
import { cn } from "@/lib/utils"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState, PageHeader } from "@/components/common"
import { ParamSelect } from "@/components/param-select"
import { HeadcountForm, NotesList, type HeadcountSource, type RegisterNumbers } from "./headcount-client"

export const metadata = { title: "Weekly headcount" }

type SP = { date?: string; year?: string; month?: string; source?: string; calc?: string }

const NUM_FIELDS = ["workers", "members", "firstTimers", "secondTimers", "male", "female", "children", "guests", "total"] as const
type NumField = (typeof NUM_FIELDS)[number]
const NUM_LABELS: Record<NumField, string> = {
  workers: "Workers", members: "Members", firstTimers: "1st", secondTimers: "2nd",
  total: "Total", male: "Male", female: "Female", children: "Children", guests: "Guests",
}
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
const SOURCE_LABEL: Record<HeadcountSource, string> = { upload: "From attendance", manual: "Entered by hand", chart: "Chart sheet" }

function sourceOf(h: { uploadId: number | null; fromRegister: boolean; upload: { kind: string } | null }): HeadcountSource {
  if (followsRegister(h)) return "upload"
  if (h.uploadId != null) return "chart"
  return "manual"
}

export default async function HeadcountPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requirePermission("headcount.manage")
  const sp = await searchParams
  const services = await prisma.service.findMany({
    orderBy: { date: "desc" },
    include: {
      headcounts: { orderBy: { version: "desc" }, include: { upload: { select: { kind: true } } } },
      notes: { orderBy: { id: "asc" } },
      _count: { select: { attendance: true } },
    },
  })
  const sunday = isoDate(lastSunday())
  const recent = [...new Set([sunday, ...services.map((s) => isoDate(s.date))])].sort().reverse().slice(0, 20)
  const chosen = sp.date ?? sunday
  const current = services.find((s) => isoDate(s.date) === chosen)
  const cur = current?.headcounts.find((h) => h.isCurrent)
  const reg = current?.recordTaken && current._count.attendance > 0 ? (await registerBreakdown(chosen, chosen, {}))[chosen] : undefined
  const register: RegisterNumbers | null = reg
    ? { workers: reg.workers, members: reg.members, firstTimers: reg.firstTimers, secondTimers: reg.secondTimers, male: reg.male, female: reg.female }
    : null

  // Every Sunday with a headcount, newest first, with its current version.
  const rows = services.flatMap((s) => {
    const h = s.headcounts.find((x) => x.isCurrent) ?? s.headcounts[0]
    return h ? [{ service: s, date: isoDate(s.date), h, source: sourceOf(h) }] : []
  })

  // Filters
  const years = [...new Set(rows.map((r) => r.date.slice(0, 4)))].sort().reverse()
  const year = sp.year === "all" ? "" : years.includes(sp.year ?? "") ? sp.year! : years[0] ?? ""
  const month = /^(0[1-9]|1[0-2])$/.test(sp.month ?? "") ? sp.month! : ""
  const source = sp.source && sp.source in SOURCE_LABEL ? sp.source as HeadcountSource : ""
  const filteredRows = rows.filter((r) =>
    (!year || r.date.startsWith(year)) && (!month || r.date.slice(5, 7) === month) && (!source || r.source === source))
  const filtersOn = sp.year !== undefined || !!month || !!source

  // Monthly calculations over the filtered Sundays.
  const calc = sp.calc === "sum" ? "sum" : "avg"
  const byMonth = new Map<string, typeof filteredRows>()
  for (const r of filteredRows) byMonth.set(r.date.slice(0, 7), [...(byMonth.get(r.date.slice(0, 7)) ?? []), r])
  const summarize = (list: typeof filteredRows) => {
    const sums = Object.fromEntries(NUM_FIELDS.map((f) => [f, list.reduce((a, r) => a + r.h[f], 0)])) as Record<NumField, number>
    const avgs = Object.fromEntries(NUM_FIELDS.map((f) => [f, list.length ? Math.round(sums[f] / list.length) : 0])) as Record<NumField, number>
    const totals = list.map((r) => r.h.total)
    return { sundays: list.length, sums, avgs, high: Math.max(...totals), low: Math.min(...totals) }
  }
  const months = [...byMonth].sort(([a], [b]) => b.localeCompare(a)).map(([key, list]) => ({ key, ...summarize(list) }))
  const overall = filteredRows.length ? summarize(filteredRows) : null
  const monthLabel = (key: string) => `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`
  const calcHref = (c: "avg" | "sum") => {
    const q = new URLSearchParams(Object.entries({ ...sp, calc: c === "sum" ? "sum" : undefined }).filter(([, v]) => v) as [string, string][])
    return `?${q}`
  }
  const periodLabel = month ? `${MONTHS[Number(month) - 1]}${year ? ` ${year}` : " (all years)"}` : year || "all years"

  return (
    <div className="stagger space-y-4">
      <PageHeader title="Weekly headcount" description="Filled automatically from each attendance upload. Add children and guests/pastors by hand; the total (everyone) is what the dashboard and trends show. Changing a Sunday keeps the old version." />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sunday headcount</CardTitle>
            <CardDescription>Total = Workers + Members + First + Second timers + Children + Guests &amp; pastors.</CardDescription>
          </CardHeader>
          <CardContent>
            <HeadcountForm
              key={`${chosen}-${cur?.id ?? "new"}-${cur?.version ?? 0}`}
              date={chosen}
              dates={recent}
              existing={cur ? { workers: cur.workers, members: cur.members, firstTimers: cur.firstTimers, secondTimers: cur.secondTimers, male: cur.male, female: cur.female, children: cur.children, guests: cur.guests, total: cur.total } : null}
              registered={current?._count.attendance ?? 0}
              register={register}
              source={cur ? sourceOf(cur) : null}
            />
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-medium">Notes for {formatDate(chosen, "long")}</h3>
              <NotesList date={chosen} notes={(current?.notes ?? []).map((n) => ({ id: n.id, type: n.type, text: n.text }))} />
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-base">Monthly calculations</CardTitle>
            <CardDescription>{calc === "avg" ? "Average per Sunday" : "Totals added up"} for each month in {periodLabel}.</CardDescription>
            <CardAction>
              <div className="inline-flex rounded-md border p-0.5 text-sm" role="group" aria-label="Calculation">
                {(["avg", "sum"] as const).map((c) => (
                  <NavLink key={c} href={calcHref(c)} aria-current={calc === c}
                    className={cn("rounded px-2.5 py-1", calc === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                    {c === "avg" ? "Average" : "Sum"}
                  </NavLink>
                ))}
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="px-0">
            {months.length === 0 ? <div className="px-6"><EmptyState title="No headcounts match these filters" /></div> : (
              <div className="max-h-[520px] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-card">
                    <TableRow>
                      <TableHead className="pl-6">Month</TableHead>
                      <TableHead className="text-right">Sundays</TableHead>
                      {NUM_FIELDS.map((f) => <TableHead key={f} className="text-right">{NUM_LABELS[f]}</TableHead>)}
                      <TableHead className="pr-6 text-right whitespace-nowrap">High / Low</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {months.map((m) => (
                      <TableRow key={m.key}>
                        <TableCell className="pl-6 whitespace-nowrap">{monthLabel(m.key)}</TableCell>
                        <TableCell className="text-right tabular-nums">{m.sundays}</TableCell>
                        {NUM_FIELDS.map((f) => (
                          <TableCell key={f} className={cn("text-right tabular-nums", f === "total" && "font-semibold")}>{(calc === "avg" ? m.avgs : m.sums)[f]}</TableCell>
                        ))}
                        <TableCell className="pr-6 text-right tabular-nums text-muted-foreground whitespace-nowrap">{m.high} / {m.low}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  {overall && months.length > 1 && (
                    <TableFooter>
                      <TableRow>
                        <TableCell className="pl-6 font-medium whitespace-nowrap">All shown</TableCell>
                        <TableCell className="text-right tabular-nums">{overall.sundays}</TableCell>
                        {NUM_FIELDS.map((f) => (
                          <TableCell key={f} className={cn("text-right tabular-nums", f === "total" && "font-semibold")}>{(calc === "avg" ? overall.avgs : overall.sums)[f]}</TableCell>
                        ))}
                        <TableCell className="pr-6 text-right tabular-nums text-muted-foreground whitespace-nowrap">{overall.high} / {overall.low}</TableCell>
                      </TableRow>
                    </TableFooter>
                  )}
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-card/70 p-2 shadow-card backdrop-blur" role="group" aria-label="Filters">
        <span className="hidden px-2 text-sm font-medium text-muted-foreground sm:inline">Filter</span>
        <ParamSelect className="min-w-0 flex-1 sm:flex-none" name="year" label="Year" value={sp.year === "all" ? "all" : year}
          options={[...years.map((y) => ({ value: y, label: y })), { value: "all", label: "All years" }]} />
        <ParamSelect className="min-w-0 flex-1 sm:flex-none" name="month" label="Month" value={month}
          options={[{ value: "", label: "All months" }, ...MONTHS.map((m, i) => ({ value: String(i + 1).padStart(2, "0"), label: m }))]} />
        <ParamSelect className="min-w-0 flex-1 sm:flex-none" name="source" label="Source" value={source}
          options={[{ value: "", label: "Any source" }, ...Object.entries(SOURCE_LABEL).map(([value, label]) => ({ value, label }))]} />
        {filtersOn && <Button variant="ghost" size="sm" asChild><NavLink href={sp.date ? `?date=${sp.date}` : "?"}>Clear filters</NavLink></Button>}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Sundays with a headcount ({filteredRows.length})</CardTitle></CardHeader>
        <CardContent className="px-0">
          {filteredRows.length === 0 ? <div className="px-6"><EmptyState title="No headcounts match these filters" /></div> : (
            <div className="max-h-[60vh] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead className="pl-6">Sunday</TableHead>
                    {NUM_FIELDS.map((f) => <TableHead key={f} className="text-right">{NUM_LABELS[f]}</TableHead>)}
                    <TableHead className="text-right">Registered</TableHead>
                    <TableHead className="pr-6">Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map(({ service: s, date, h, source: src }) => {
                    const mismatch = h.male + h.female + h.children + h.guests !== h.total
                    return (
                      <TableRow key={s.id} className={cn(date === chosen && "bg-muted/50")}>
                        <TableCell className="pl-6 whitespace-nowrap">
                          <Link className="hover:underline" href={`/headcount?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([, v]) => v)), date })}`}>{formatDate(date, "long")}</Link>
                        </TableCell>
                        {NUM_FIELDS.map((f) => <TableCell key={f} className={cn("text-right tabular-nums", f === "total" && "font-semibold")}>{h[f]}</TableCell>)}
                        <TableCell className="text-right tabular-nums text-muted-foreground">{s._count.attendance}</TableCell>
                        <TableCell className="pr-6">
                          <div className="flex flex-wrap gap-1">
                            <Badge variant={src === "upload" ? "secondary" : "outline"}>{SOURCE_LABEL[src]}</Badge>
                            {s.headcounts.length > 1 && <Badge variant="outline">v{h.version} of {s.headcounts.length}</Badge>}
                            {mismatch && <Badge variant="outline" className="text-status-warn">Gender split ≠ total</Badge>}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
