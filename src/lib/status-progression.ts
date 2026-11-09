import type { PrismaClient } from "@prisma/client"

/**
 * Automatic step-up when an existing person is found attending again:
 * First Timer → Second Timer → Regular. Regular is the last automatic stage;
 * Member, Worker, etc. are only ever set by hand.
 */
export const NEXT_STATUS: Record<string, string> = {
  "First Timer": "Second Timer",
  "Second Timer": "Regular, not done membership class",
}

export function nextStatus(status: string): string | null {
  return NEXT_STATUS[status] ?? null
}

type Db = Pick<PrismaClient, "member" | "statusHistory">

/** Move each member up one stage (at most once per call). Returns how many were promoted. */
export async function promoteFoundMembers(db: Db, memberIds: Iterable<number>, reason: string): Promise<number> {
  const ids = [...new Set(memberIds)]
  if (!ids.length) return 0
  const members = await db.member.findMany({
    where: { id: { in: ids }, deletedAt: null, status: { in: Object.keys(NEXT_STATUS) } },
    select: { id: true, status: true },
  })
  // Group by current status first so nobody jumps two stages in one go.
  const byStatus = new Map<string, number[]>()
  for (const m of members) byStatus.set(m.status, [...(byStatus.get(m.status) ?? []), m.id])
  for (const [from, group] of byStatus) {
    await db.member.updateMany({ where: { id: { in: group }, status: from }, data: { status: NEXT_STATUS[from] } })
  }
  if (members.length) {
    await db.statusHistory.createMany({
      data: members.map((m) => ({ memberId: m.id, old: m.status, new: NEXT_STATUS[m.status], reason })),
    })
  }
  return members.length
}
