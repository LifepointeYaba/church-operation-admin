import Link from "next/link"
import type { AbsentMember } from "@/lib/metrics/absent"
import { ALL_STATUSES } from "@/lib/metrics/absent"
import { displayPhone } from "@/lib/phone"
import { formatDate } from "@/lib/dates"
import { ParamSelect } from "@/components/param-select"
import { HBarChart } from "@/components/charts"
import { ViewToggle } from "@/components/view-toggle"
import { StatusBadge, shortStatus } from "@/components/common"
import { AbsentExportButton } from "./absent-export-button"
import { AbsentDateRange } from "./absent-date-range"

export function AbsentMembers({ people, from, to, dates, team, teams, status, statuses, gender }: {
  people: AbsentMember[]
  from: string
  to: string
  dates: string[]
  team: string
  teams: string[]
  status: string
  statuses: string[]
  gender: string
}) {
  const byStatus = new Map<string, number>()
  for (const m of people) byStatus.set(m.status, (byStatus.get(m.status) ?? 0) + 1)
  const statusData = [...byStatus].map(([name, value]) => ({ name: shortStatus(name), value })).sort((a, b) => b.value - a.value)
  const empty = <p className="text-sm text-muted-foreground">No one matching these filters last came in this date range.</p>

  return (
    <ViewToggle
      id="absent-members"
      toolbar={
        <>
          <AbsentDateRange from={from} to={to} min={dates.at(-1)} max={dates[0]} />
          <ParamSelect className="min-w-0 flex-1 sm:flex-none" name="abs_team" label="Workers' team" value={team}
            options={[{ value: "", label: "All teams" }, ...teams.map((t) => ({ value: t, label: t }))]} />
          <ParamSelect className="min-w-0 flex-1 sm:flex-none" name="abs_status" label="Status" value={status}
            options={[
              { value: "", label: "All except Not Active" },
              { value: ALL_STATUSES, label: "Every status" },
              ...statuses.map((s) => ({ value: s, label: s })),
            ]} />
          <ParamSelect className="min-w-0 flex-1 sm:flex-none" name="abs_gender" label="Gender" value={gender}
            options={[{ value: "", label: "Any gender" }, { value: "Female", label: "Female" }, { value: "Male", label: "Male" }]} />
          <AbsentExportButton disabled={people.length === 0}
            params={{ abs_from: from, abs_to: to, abs_team: team, abs_status: status, abs_gender: gender }} />
        </>
      }
      chart={statusData.length ? (
        <div className="space-y-1">
          <p className="text-sm font-medium">Absent by status</p>
          <HBarChart data={statusData} valueLabel="Absent" />
        </div>
      ) : empty}
      table={people.length === 0 ? empty : (
        <div className="max-h-[480px] overflow-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted">
              <tr className="text-left">
                <th scope="col" className="px-3 py-2 font-medium">Name</th>
                <th scope="col" className="px-3 py-2 font-medium">Phone</th>
                <th scope="col" className="hidden px-3 py-2 font-medium sm:table-cell">Status</th>
                <th scope="col" className="hidden px-3 py-2 font-medium lg:table-cell">Gender</th>
                <th scope="col" className="hidden px-3 py-2 font-medium md:table-cell">Team</th>
                <th scope="col" className="px-3 py-2 font-medium whitespace-nowrap">Last came</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Missed</th>
              </tr>
            </thead>
            <tbody>
              {people.map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="px-3 py-2"><Link href={`/members/${m.id}`} className="font-medium hover:underline">{m.firstName} {m.lastName}</Link></td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {m.phone ? <a href={`tel:${m.phone}`} className="hover:underline">{displayPhone(m.phone)}</a> : <span className="text-muted-foreground">No phone</span>}
                  </td>
                  <td className="hidden px-3 py-2 sm:table-cell"><StatusBadge status={m.status} /></td>
                  <td className="hidden px-3 py-2 text-muted-foreground lg:table-cell">{m.gender ?? "—"}</td>
                  <td className="hidden px-3 py-2 text-muted-foreground md:table-cell">{m.teams.join(", ") || "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{m.lastDate ? formatDate(m.lastDate) : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums" title="Sundays missed since they last came">{m.lastRn! - 1}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    />
  )
}
