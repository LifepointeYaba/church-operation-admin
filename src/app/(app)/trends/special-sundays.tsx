import { NavLink } from "@/components/navigation"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyState } from "@/components/common"
import { formatDate } from "@/lib/dates"
import { cn } from "@/lib/utils"

export type LabeledSunday = { date: string; label: string | null; attendance: number; firstTimers: number | null }

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

function Diff({ value, base }: { value: number | null; base: number | null }) {
  if (value == null || !base) return <span className="text-muted-foreground">—</span>
  const pct = Math.round(((value - base) / base) * 100)
  return <span className={cn("font-medium tabular-nums", pct > 0 ? "text-emerald-600 dark:text-emerald-400" : pct < 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>{pct > 0 ? "+" : ""}{pct}%</span>
}

/** Labelled Sundays ("Flicks & Talks") against the regular-Sunday average in the same range. */
export function SpecialSundays({ sundays }: { sundays: LabeledSunday[] }) {
  const regular = sundays.filter((s) => !s.label)
  const regAtt = avg(regular.map((s) => s.attendance))
  const regFirst = avg(regular.flatMap((s) => (s.firstTimers == null ? [] : [s.firstTimers])))
  const special = sundays.filter((s) => s.label)
  if (!special.length) {
    return <EmptyState title="No labelled Sundays in this range">Open a Sunday card on the dashboard and give it a label (e.g. “Flicks & Talks”) to compare it here.</EmptyState>
  }
  const labels = [...new Set(special.map((s) => s.label!))]
  const byLabel = labels.map((label) => {
    const xs = special.filter((s) => s.label === label)
    return {
      label,
      count: xs.length,
      attendance: avg(xs.map((s) => s.attendance)),
      firstTimers: avg(xs.flatMap((s) => (s.firstTimers == null ? [] : [s.firstTimers]))),
    }
  }).sort((a, b) => (b.attendance ?? 0) - (a.attendance ?? 0))
  const r = (n: number | null) => (n == null ? "—" : Math.round(n).toLocaleString())
  return (
    <div className="space-y-5">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kind of Sunday</TableHead>
              <TableHead className="text-right">Sundays</TableHead>
              <TableHead className="text-right">Avg attendance</TableHead>
              <TableHead className="text-right">vs regular</TableHead>
              <TableHead className="text-right">Avg first timers</TableHead>
              <TableHead className="text-right">vs regular</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {byLabel.map((g) => (
              <TableRow key={g.label}>
                <TableCell className="font-medium">{g.label}</TableCell>
                <TableCell className="text-right tabular-nums">{g.count}</TableCell>
                <TableCell className="text-right tabular-nums">{r(g.attendance)}</TableCell>
                <TableCell className="text-right"><Diff value={g.attendance} base={regAtt} /></TableCell>
                <TableCell className="text-right tabular-nums">{r(g.firstTimers)}</TableCell>
                <TableCell className="text-right"><Diff value={g.firstTimers} base={regFirst} /></TableCell>
              </TableRow>
            ))}
            <TableRow className="text-muted-foreground">
              <TableCell>Regular Sundays</TableCell>
              <TableCell className="text-right tabular-nums">{regular.length}</TableCell>
              <TableCell className="text-right tabular-nums">{r(regAtt)}</TableCell>
              <TableCell />
              <TableCell className="text-right tabular-nums">{r(regFirst)}</TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </div>
      <div>
        <h4 className="mb-2 text-sm font-semibold">Each special Sunday</h4>
        <ul className="divide-y text-sm">
          {[...special].reverse().map((s) => (
            <li key={s.date} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                <NavLink href={`/dashboard?date=${s.date}`} className="font-medium hover:underline">{formatDate(s.date, "long")}</NavLink>
                <span className="text-muted-foreground"> · {s.label}</span>
              </span>
              <span className="flex items-center gap-3 tabular-nums">
                <span>{s.attendance.toLocaleString()} present</span>
                <Diff value={s.attendance} base={regAtt} />
                {s.firstTimers != null && <span className="text-muted-foreground">{s.firstTimers} first timers</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
