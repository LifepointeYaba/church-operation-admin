import Link from "next/link"
import { displayPhone } from "@/lib/phone"
import { formatDate } from "@/lib/dates"
import type { MemberStat } from "@/lib/metrics"
import { StatusBadge } from "./common"

/** Compact list of people for dashboard alerts and call lists. */
export function PersonList({ people, limit = 8, extra, empty = "No one" }: { people: MemberStat[]; limit?: number; extra?: (m: MemberStat) => React.ReactNode; empty?: string }) {
  if (!people.length) return <p className="text-sm text-muted-foreground">{empty}</p>
  return (
    <ul className="divide-y text-sm">
      {people.slice(0, limit).map((m) => (
        <li key={m.id} className="flex items-center justify-between gap-2 py-2">
          <div className="min-w-0">
            <Link href={`/members/${m.id}`} className="block truncate font-medium hover:underline">{m.firstName} {m.lastName}</Link>
            <span className="block truncate text-xs text-muted-foreground">
              {displayPhone(m.phone) || "No phone"}{m.teams.length ? ` · ${m.teams.join(", ")}` : ""}
            </span>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <StatusBadge status={m.status} />
            <span className="text-xs text-muted-foreground">{extra ? extra(m) : m.lastDate ? `Last ${formatDate(m.lastDate)}` : "Never"}</span>
          </div>
        </li>
      ))}
      {people.length > limit && <li className="pt-2 text-xs text-muted-foreground">+{people.length - limit} more</li>}
    </ul>
  )
}
