import { NavLink } from "@/components/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { BREAKDOWN_ROWS, type Breakdown } from "@/lib/metrics/breakdown"
import { formatDate } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { HeadcountChart } from "@/components/charts"
import { ViewToggle } from "@/components/view-toggle"

type Column = { date: string; values: Breakdown | null; present: number | null; notes: { type: string; text: string }[] }

const avg = (xs: (number | null | undefined)[]) => {
  const v = xs.filter((x): x is number => x != null)
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null
}

/** The weekly numbers in the same layout as the "Chart" sheet: one column per Sunday of the month, plus the average. */
export function SundayNumbers({ month, columns, selected, source, prevHref, nextHref, hrefFor }: {
  month: string; columns: Column[]; selected: string; source: "headcount" | "register"
  prevHref: string | null; nextHref: string | null; hrefFor: (date: string) => string
}) {
  const title = new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })
  const hasNotes = columns.some((c) => c.notes.length)
  const points = columns.flatMap((c) => (c.values ? [{ date: c.date, ...c.values }] : []))
  return (
    <div className="space-y-3">
      <ViewToggle
        id="sunday-numbers"
        toolbar={
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Attendance in {title}</p>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" className="size-8" asChild={!!prevHref} disabled={!prevHref} aria-label="Previous month">
            {prevHref ? <NavLink href={prevHref}><ChevronLeft className="size-4" /></NavLink> : <ChevronLeft className="size-4" />}
          </Button>
          <Button variant="outline" size="icon" className="size-8" asChild={!!nextHref} disabled={!nextHref} aria-label="Next month">
            {nextHref ? <NavLink href={nextHref}><ChevronRight className="size-4" /></NavLink> : <ChevronRight className="size-4" />}
          </Button>
        </div>
      </div>
        }
        table={
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full border-collapse text-sm tabular-nums">
          <thead>
            <tr className="border-b bg-muted">
              <th scope="col" className="sticky left-0 z-10 bg-muted px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">
                <span className="sr-only">Measure</span>
              </th>
              {columns.map((c) => (
                <th key={c.date} scope="col" className={cn("px-4 py-2.5 text-right text-xs font-semibold whitespace-nowrap text-muted-foreground", c.date === selected && "bg-primary-soft text-primary")}>
                  <NavLink href={hrefFor(c.date)} className="hover:underline">{formatDate(c.date)}</NavLink>
                </th>
              ))}
              <th scope="col" className="border-l px-4 py-2.5 text-right text-xs font-semibold whitespace-nowrap text-muted-foreground">Average</th>
            </tr>
          </thead>
          <tbody>
            {BREAKDOWN_ROWS.map((r) => (
              <tr key={r.key} className={cn("border-b transition-colors last:border-0 hover:bg-muted/40", r.strong && "bg-muted/30")}>
                <th scope="row" className={cn("sticky left-0 z-10 bg-card px-4 py-2 text-left whitespace-nowrap", r.strong ? "font-semibold" : "font-medium")}>{r.label}</th>
                {columns.map((c) => {
                  const v = c.values?.[r.key]
                  return (
                    <td key={c.date} className={cn("px-4 py-2 text-right", r.strong && "font-semibold", c.date === selected && "bg-primary-soft/50")}>
                      {v ?? <span className="text-muted-foreground">—</span>}
                    </td>
                  )
                })}
                <td className={cn("border-l px-4 py-2 text-right", r.strong && "font-semibold")}>
                  {avg(columns.map((c) => c.values?.[r.key])) ?? <span className="text-muted-foreground">—</span>}
                </td>
              </tr>
            ))}
            {source === "headcount" && (
              <tr className="border-t text-muted-foreground">
                <th scope="row" className="sticky left-0 z-10 bg-card px-4 py-2.5 text-left font-normal whitespace-nowrap">Present</th>
                {columns.map((c) => (
                  <td key={c.date} className={cn("px-4 py-2.5 text-right", c.date === selected && "bg-primary-soft/50")}>{c.present ?? "—"}</td>
                ))}
                <td className="border-l px-4 py-2.5 text-right">{avg(columns.map((c) => c.present)) ?? "—"}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
        }
        chart={
          points.length
            ? <HeadcountChart points={points} maxBarSize={56} />
            : <p className="text-sm text-muted-foreground">No numbers for this month yet.</p>
        }
      />
      {hasNotes && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {columns.filter((c) => c.notes.length).map((c) => (
            <div key={c.date} className={cn("rounded-md border p-3 text-sm", c.date === selected && "border-primary/40 bg-primary/5")}>
              <p className="mb-1 font-medium">{formatDate(c.date, "long")}</p>
              <ul className="space-y-0.5 text-muted-foreground">
                {c.notes.map((n, i) => <li key={i} className={cn(n.text.toLowerCase().endsWith("distribution") && "pt-1 font-medium text-foreground first:pt-0")}>{n.text}</li>)}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
