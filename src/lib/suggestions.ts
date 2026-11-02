import { prisma } from "./db"
import type { AppSettings } from "./settings"
import { activityOf, type MemberStat } from "./metrics"

/** Create pending status suggestions (never applied automatically). */
export async function syncSuggestions(stats: MemberStat[], s: AppSettings) {
  const wanted: { memberId: number; fromStatus: string; toStatus: string; reason: string }[] = []
  for (const m of stats) {
    const a = activityOf(m, s)
    if (a === "inactive" && m.status !== "Not Active" && m.status !== "Member from other expressions") {
      wanted.push({ memberId: m.id, fromStatus: m.status, toStatus: "Not Active", reason: `Missed the last ${m.lastRn! - 1} Sundays` })
    }
    if (m.status === "Not Active" && a === "active") {
      wanted.push({
        memberId: m.id, fromStatus: m.status, toStatus: m.visits >= 4 ? "Regular, not done membership class" : "Second Timer",
        reason: `Marked Not Active but attended ${m.streak > 0 ? "this Sunday" : `on ${m.lastDate}`}`,
      })
    }
  }
  if (!wanted.length) return
  const existing = await prisma.statusSuggestion.findMany({
    where: { memberId: { in: wanted.map((w) => w.memberId) } },
    select: { memberId: true, fromStatus: true, toStatus: true },
  })
  const have = new Set(existing.map((e) => `${e.memberId}|${e.fromStatus}|${e.toStatus}`))
  const fresh = wanted.filter((w) => !have.has(`${w.memberId}|${w.fromStatus}|${w.toStatus}`))
  if (fresh.length) await prisma.statusSuggestion.createMany({ data: fresh })
  // Drop pending suggestions that no longer apply (status already changed).
  await prisma.$executeRaw`
    DELETE FROM status_suggestions ss USING members m
    WHERE ss.member_id = m.id AND ss.state = 'pending' AND m.status <> ss.from_status`
}
