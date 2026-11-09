import Link from "next/link"
import type { MemberStat } from "@/lib/metrics"
import { prisma } from "@/lib/db"
import { displayPhone } from "@/lib/phone"
import { formatDate } from "@/lib/dates"
import { ParamSelect } from "@/components/param-select"
import { HBarChart } from "@/components/charts"
import { ViewToggle } from "@/components/view-toggle"
import { StatusBadge, shortStatus } from "@/components/common"

/** Status filter value meaning "every status, including Not Active". The default (empty) hides Not Active. */
export const ALL_STATUSES = "all"

/** The latest Sunday in the most recent attendance upload, used as this card's default date. */
export async function lastUploadedSunday(): Promise<string | null> {
  const uploads = await prisma.upload.findMany({
    where: { kind: "attendance", status: { not: "failed" } },
    orderBy: { uploadedAt: "desc" },
    take: 5,
    select: { summary: true },
  })
  for (const u of uploads) {
    const dates = (u.summary as { serviceDates?: unknown } | null)?.serviceDates
    if (Array.isArray(dates)) {
      const latest = dates.filter((d): d is string => typeof d === "string").sort().at(-1)
      if (latest) return latest
    }
  }
  return null
}

/** People not marked present on the chosen Sunday (who had started attending by then). */
export function absentOn(stats: MemberStat[], statusFilter: string) {
  return stats
    .filter((m) => !m.p1 && m.lastRn != null)
    .filter((m) => statusFilter ? true : m.status !== "Not Active")
    .sort((a, b) => (a.lastRn! - b.lastRn!) || a.firstName.localeCompare(b.firstName))
}

export function AbsentMembers({ people, date, dates, team, teams, status, statuses, gender }: {
  people: MemberStat[]
  date: string
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
  const empty = <p className="text-sm text-muted-foreground">Everyone matching these filters came.</p>

  return (
    <ViewToggle
      id="absent-members"
      toolbar={
        <>
          <ParamSelect className="min-w-0 flex-1 sm:flex-none" name="abs_date" label="Sunday" value={date}
            options={dates.map((d) => ({ value: d, label: formatDate(d, "long") }))} />
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
                  <td className="px-3 py-2 text-right tabular-nums" title="Sundays missed in a row">{m.lastRn! - 1}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    />
  )
}
