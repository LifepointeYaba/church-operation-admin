import Link from "next/link"
import { displayPhone } from "@/lib/phone"
import { formatDate } from "@/lib/dates"
import type { MemberStat } from "@/lib/metrics"
import { cn } from "@/lib/utils"
import { shortStatus } from "./common"

const DOT: Record<string, string> = {
  Worker: "bg-primary",
  Member: "bg-primary/60",
  "First Timer": "bg-bark",
  "Second Timer": "bg-bark/60",
  "Regular, not done membership class": "bg-warning",
}

/** Compact list of people for dashboard alerts and call lists: avatar, name, status dot, last seen. */
export function PersonList({ people, limit = 8, extra, empty = "No one" }: { people: MemberStat[]; limit?: number; extra?: (m: MemberStat) => React.ReactNode; empty?: string }) {
  if (!people.length) return <p className="text-sm text-muted-foreground">{empty}</p>
  return (
    <ul className="text-sm">
      {people.slice(0, limit).map((m) => (
        <li key={m.id} className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 py-2 sm:grid-cols-[36px_minmax(0,1fr)_112px_auto]">
          <span className="flex size-9 items-center justify-center rounded-full bg-muted text-xs font-bold text-foreground" aria-hidden>
            {m.firstName[0]}{m.lastName[0] ?? ""}
          </span>
          <div className="min-w-0">
            <Link href={`/members/${m.id}`} className="block truncate font-semibold hover:underline">{m.firstName} {m.lastName}</Link>
            <span className="block truncate text-xs text-muted-foreground">
              {displayPhone(m.phone) || "No phone"}{m.teams.length ? ` · ${m.teams.join(", ")}` : ""}
            </span>
          </div>
          <span className="hidden items-center gap-2 truncate text-xs font-semibold sm:flex" title={m.status}>
            <span className={cn("size-2 shrink-0 rounded-full", DOT[m.status] ?? "bg-muted-foreground")} aria-hidden />
            {shortStatus(m.status)}
          </span>
          <span className="text-right text-xs font-semibold whitespace-nowrap text-muted-foreground tabular-nums">{extra ? extra(m) : m.lastDate ? formatDate(m.lastDate) : "Never"}</span>
        </li>
      ))}
      {people.length > limit && <li className="pt-2 text-xs text-muted-foreground">+{people.length - limit} more</li>}
    </ul>
  )
}
