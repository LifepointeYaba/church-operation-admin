import type { AppSettings } from "../settings"
import { activityOf, type MemberStat } from "./index"

/** Weekly call lists for the reference Sunday. */
export function callLists(stats: MemberStat[], refIso: string, s: AppSettings) {
  const byLastAsc = (a: MemberStat, b: MemberStat) => (a.lastDate ?? "").localeCompare(b.lastDate ?? "")
  const worthCounting = (m: MemberStat) => m.visits >= s.minVisitsForRisk
  return {
    firstTimers: stats.filter((m) => m.firstDate === refIso),
    secondTimers: stats.filter((m) => m.secondDate === refIso),
    newlyAtRisk: stats.filter((m) => worthCounting(m) && m.lastRn === s.atRiskWeeks + 1).sort(byLastAsc),
    newlyInactive: stats.filter((m) => worthCounting(m) && m.lastRn === s.inactiveWeeks + 1).sort(byLastAsc),
    workersMissed: stats
      .filter((m) => m.status === "Worker" && m.lastRn != null && m.lastRn > s.workerMissWeeks)
      .sort(byLastAsc),
    slippingRegulars: stats
      .filter((m) => m.lastRn != null && m.lastRn > s.atRiskWeeks && m.visits5to16 >= 3)
      .sort(byLastAsc),
  }
}

export type CallListKey = keyof ReturnType<typeof callLists>

export const CALL_LIST_LABELS: Record<CallListKey, string> = {
  firstTimers: "New first timers",
  secondTimers: "Second timers",
  slippingRegulars: "Regulars slipping away",
  newlyAtRisk: "Newly at risk",
  newlyInactive: "Newly inactive",
  workersMissed: "Workers who missed 2+",
}

export function summarize(stats: MemberStat[], s: AppSettings) {
  const counts = { active: 0, at_risk: 0, inactive: 0, lapsed: 0, never: 0 }
  for (const m of stats) counts[activityOf(m, s)]++
  return {
    ...counts,
    present: stats.filter((m) => m.p1).length,
    streak3: stats.filter((m) => m.streak >= 3).length,
    cameLastNotThis: stats.filter((m) => m.p2 && !m.p1),
    cameThisNotLast: stats.filter((m) => m.p1 && !m.p2),
    returnees: stats.filter((m) => m.p1 && m.prevRn != null && m.prevRn - 2 >= s.inactiveWeeks),
    streaks: stats.filter((m) => m.streak >= 3).sort((a, b) => b.streak - a.streak),
    mismatches: stats.filter((m) => m.status === "Not Active" && activityOf(m, s) === "active"),
  }
}

export const FUNNEL = ["First Timer", "Second Timer", "Regular, not done membership class", "Member", "Worker"]
