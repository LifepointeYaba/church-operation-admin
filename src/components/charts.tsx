"use client"

import { useMemo, useState } from "react"
import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, XAxis, YAxis } from "recharts"
import {
  ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig,
} from "@/components/ui/chart"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDate } from "@/lib/dates"

const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" })

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-md border p-0.5">
      {options.map(([v, l]) => (
        <Button key={v} size="sm" variant={value === v ? "secondary" : "ghost"} className="h-7" aria-pressed={value === v} onClick={() => onChange(v)}>{l}</Button>
      ))}
    </div>
  )
}

/** Dark tooltip used on line charts. */
const DARK_TOOLTIP = "border-none bg-[#2a2a2a] text-white shadow-lg [&_.text-foreground]:text-white [&_.text-muted-foreground]:text-white/70"

export type SundayPoint = { date: string; present: number; total: number | null }
export type MonthPoint = { month: string; present: number | null; headcount: number | null; sundays: number }

const lineConfig = {
  present: { label: "Registered present", color: "var(--chart-1)" },
  headcount: { label: "Headcount total", color: "var(--chart-2)" },
} satisfies ChartConfig

/** Registered present vs headcount total. Both are head counts on one axis. */
export function AttendanceChart({ sundays, months, defaultFrom = "2025-01-01", allowHistory = true }: { sundays: SundayPoint[]; months: MonthPoint[]; defaultFrom?: string; allowHistory?: boolean }) {
  const [view, setView] = useState<"month" | "sunday">("month")
  const [full, setFull] = useState(false)
  const from = full ? "0000" : defaultFrom
  const data = useMemo(
    () =>
      view === "month"
        ? months.filter((m) => `${m.month}-01` >= from).map((m) => ({ x: m.month, label: monthLabel(m.month), present: m.present, headcount: m.headcount }))
        : sundays.filter((s) => s.date >= from).map((s) => ({ x: s.date, label: formatDate(s.date), present: s.present, headcount: s.total })),
    [view, months, sundays, from],
  )
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented label="Granularity" value={view} onChange={setView} options={[["month", "Monthly average"], ["sunday", "Each Sunday"]]} />
        {allowHistory && (
          <div className="flex items-center gap-2 text-sm">
            <Switch id="full" checked={full} onCheckedChange={setFull} />
            <Label htmlFor="full">Show full history</Label>
          </div>
        )}
      </div>
      <ChartContainer config={lineConfig} className="aspect-auto h-72 w-full">
        <ComposedChart data={data} margin={{ left: 4, right: 12, top: 8 }} accessibilityLayer>
          <defs>
            <linearGradient id="fill-present" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-present)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--color-present)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeOpacity={0.5} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} width={36} allowDecimals={false} />
          <ChartTooltip cursor={{ strokeDasharray: "3 3" }} content={<ChartTooltipContent indicator="line" className={DARK_TOOLTIP} />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Area dataKey="present" type="monotone" stroke="var(--color-present)" strokeWidth={2.5} fill="url(#fill-present)" dot={false} activeDot={{ r: 5 }} connectNulls />
          <Line dataKey="headcount" type="monotone" stroke="var(--color-headcount)" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} connectNulls />
        </ComposedChart>
      </ChartContainer>
      <p className="text-xs text-muted-foreground">The headcount adds children and unregistered visitors, so it runs a little above the registered count. Headcounts start Jan 2026.</p>
    </div>
  )
}

export type HeadcountPoint = { date: string; workers: number; members: number; firstTimers: number; secondTimers: number; male: number; female: number; children: number | null }

const roleConfig = {
  workers: { label: "Workers", color: "var(--chart-1)" },
  members: { label: "Members", color: "var(--chart-2)" },
  firstTimers: { label: "First timers", color: "var(--chart-3)" },
  secondTimers: { label: "Second timers", color: "var(--chart-4)" },
} satisfies ChartConfig
const genderConfig = {
  male: { label: "Male", color: "var(--chart-1)" },
  female: { label: "Female", color: "var(--chart-2)" },
  children: { label: "Children", color: "var(--chart-3)" },
} satisfies ChartConfig

export function HeadcountChart({ points, maxBarSize = 28 }: { points: HeadcountPoint[]; maxBarSize?: number }) {
  const [split, setSplit] = useState<"role" | "gender">("role")
  // The register has no ages, so drop Children when it's unknown everywhere.
  const noChildren = points.every((p) => p.children == null)
  const config = split === "role" ? roleConfig : noChildren ? { male: genderConfig.male, female: genderConfig.female } : genderConfig
  const keys = Object.keys(config) as (keyof HeadcountPoint)[]
  const data = points.map((p) => ({ ...p, label: formatDate(p.date) }))
  return (
    <div className="space-y-3">
      <Segmented label="Split" value={split} onChange={setSplit} options={[["role", "Workers / Members / New"], ["gender", noChildren ? "Male / Female" : "Male / Female / Children"]]} />
      <ChartContainer config={config} className="aspect-auto h-72 w-full">
        <BarChart data={data} margin={{ left: 4, right: 12, top: 8 }} accessibilityLayer>
          <CartesianGrid vertical={false} strokeOpacity={0.5} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={16} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} width={36} allowDecimals={false} />
          <ChartTooltip cursor={{ fillOpacity: 0.3 }} content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          {keys.map((k, i) => (
            <Bar key={k} dataKey={k} stackId="a" fill={`var(--color-${k})`} stroke="var(--background)" strokeWidth={1}
              radius={i === keys.length - 1 ? [4, 4, 0, 0] : 0} maxBarSize={maxBarSize} />
          ))}
        </BarChart>
      </ChartContainer>
    </div>
  )
}

export type CohortRow = { month: string; firstTimers: number; retained: number; settled: number }
const cohortConfig = {
  retainedPct: { label: "Came back within 8 weeks", color: "var(--chart-1)" },
  settledPct: { label: "Settled (4+ visits)", color: "var(--chart-3)" },
} satisfies ChartConfig

export function CohortChart({ rows }: { rows: CohortRow[] }) {
  const [table, setTable] = useState(false)
  const data = rows.map((r) => ({
    ...r,
    label: monthLabel(r.month),
    retainedPct: r.firstTimers ? Math.round((r.retained / r.firstTimers) * 100) : 0,
    settledPct: r.firstTimers ? Math.round((r.settled / r.firstTimers) * 100) : 0,
  }))
  return (
    <div className="space-y-3">
      <Segmented label="View" value={table ? "table" : "chart"} onChange={(v) => setTable(v === "table")} options={[["chart", "Chart"], ["table", "Table"]]} />
      {table ? (
        <div className="max-h-80 overflow-auto rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 bg-background"><TableRow><TableHead>First visit</TableHead><TableHead className="text-right">First timers</TableHead><TableHead className="text-right">Returned ≤8 wks</TableHead><TableHead className="text-right">Settled (4+)</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.map((r) => (
                <TableRow key={r.month}>
                  <TableCell>{r.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.firstTimers}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.retained} <span className="text-muted-foreground">({r.retainedPct}%)</span></TableCell>
                  <TableCell className="text-right tabular-nums">{r.settled} <span className="text-muted-foreground">({r.settledPct}%)</span></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <ChartContainer config={cohortConfig} className="aspect-auto h-72 w-full">
          <BarChart data={data} margin={{ left: 4, right: 12, top: 8 }} barGap={2} accessibilityLayer>
            <CartesianGrid vertical={false} strokeOpacity={0.5} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={12} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} width={40} unit="%" domain={[0, 100]} />
            <ChartTooltip content={<ChartTooltipContent formatter={(v, name, item) => (
              <div className="flex w-full justify-between gap-3">
                <span className="text-muted-foreground">{cohortConfig[name as keyof typeof cohortConfig]?.label}</span>
                <span className="font-mono tabular-nums">{v}% of {item.payload.firstTimers}</span>
              </div>
            )} />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="retainedPct" fill="var(--color-retainedPct)" radius={[4, 4, 0, 0]} maxBarSize={18} />
            <Bar dataKey="settledPct" fill="var(--color-settledPct)" radius={[4, 4, 0, 0]} maxBarSize={18} />
          </BarChart>
        </ChartContainer>
      )}
    </div>
  )
}

/** Single-series horizontal bars (funnel, team rates). The card title names the series. */
export function HBarChart({ data, unit = "", valueLabel }: { data: { name: string; value: number; note?: string }[]; unit?: string; valueLabel: string }) {
  const config = { value: { label: valueLabel, color: "var(--chart-1)" } } satisfies ChartConfig
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height: Math.max(160, data.length * 30 + 30) }}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 40, top: 4, bottom: 4 }} accessibilityLayer>
        <CartesianGrid horizontal={false} strokeOpacity={0.5} />
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={150} tick={{ fontSize: 12 }} />
        <ChartTooltip cursor={{ fillOpacity: 0.2 }} content={<ChartTooltipContent hideIndicator formatter={(v, _n, item) => (
          <span className="tabular-nums">{v}{unit} {item.payload.note ? <span className="text-muted-foreground">· {item.payload.note}</span> : null}</span>
        )} />} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20} label={{ position: "right", className: "fill-foreground text-xs", formatter: (v: unknown) => `${v}${unit}` }}>
          {data.map((d) => <Cell key={d.name} fill="var(--color-value)" />)}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
