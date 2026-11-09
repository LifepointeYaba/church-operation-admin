import Link from "next/link"
import type { MemberStat } from "@/lib/metrics"
import { displayPhone } from "@/lib/phone"
import { formatDate } from "@/lib/dates"
import { ParamSelect } from "@/components/param-select"
import { HBarChart } from "@/components/charts"
import { ViewToggle } from "@/components/view-toggle"

export const MISSED_OPTIONS = [1, 2, 3, 4, 8]

/** Workers who missed at least `missed` Sundays in a row up to the selected Sunday. */
export function AbsentWorkers({ workers, missed }: { workers: MemberStat[]; missed: number }) {
  // Absent workers per team; someone in two teams counts in both.
  const byTeam = new Map<string, number>()
  for (const m of workers) for (const t of m.teams.length ? m.teams : ["No team"]) byTeam.set(t, (byTeam.get(t) ?? 0) + 1)
  const teamData = [...byTeam].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
  return (
    <ViewToggle
      id="absent-workers"
      toolbar={
        <>
          <ParamSelect
            name="missed"
            label="Missed at least"
            value={String(missed)}
            options={MISSED_OPTIONS.map((n) => ({ value: String(n), label: n === 1 ? "Absent this Sunday" : `Missed ${n}+ Sundays in a row` }))}
          />
          <Link href="/call-lists" className="text-sm text-muted-foreground hover:underline">Open call lists</Link>
        </>
      }
      chart={
        teamData.length ? (
          <div className="space-y-1">
            <p className="text-sm font-medium">Absent workers by team</p>
            <HBarChart data={teamData} valueLabel="Absent workers" />
            <p className="text-xs text-muted-foreground">Someone in two teams is counted in both.</p>
          </div>
        ) : <p className="text-sm text-muted-foreground">No workers match.</p>
      }
      table={workers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No workers match.</p>
      ) : (
        <div className="max-h-[420px] overflow-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted">
              <tr className="text-left">
                <th scope="col" className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">Name</th>
                <th scope="col" className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">Phone</th>
                <th scope="col" className="hidden px-4 py-2.5 text-xs font-semibold text-muted-foreground md:table-cell">Team</th>
                <th scope="col" className="px-4 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Last came</th>
                <th scope="col" className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">Missed</th>
              </tr>
            </thead>
            <tbody>
              {workers.map((m) => (
                <tr key={m.id} className="border-t transition-colors hover:bg-muted/40">
                  <td className="px-4 py-2.5"><Link href={`/members/${m.id}`} className="font-semibold hover:underline">{m.firstName} {m.lastName}</Link></td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {m.phone ? <a href={`tel:${m.phone}`} className="hover:underline">{displayPhone(m.phone)}</a> : <span className="text-muted-foreground">No phone</span>}
                  </td>
                  <td className="hidden px-4 py-2.5 text-muted-foreground md:table-cell">{m.teams.join(", ") || "—"}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{m.lastDate ? formatDate(m.lastDate) : "Never"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{m.lastRn == null ? "All" : m.lastRn - 1}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    />
  )
}
