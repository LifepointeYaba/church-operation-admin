import { prisma } from "./db"

/** Counts of things waiting for an admin, shown as badges in the sidebar. */
export async function attentionCounts() {
  const [uploads, suggestions] = await Promise.all([
    prisma.upload.findMany({ where: { kind: "attendance", status: "needs review" }, select: { summary: true } }),
    prisma.statusSuggestion.count({ where: { state: "pending" } }),
  ])
  let reviews = 0
  for (const u of uploads) {
    const s = u.summary as { membersPendingApproval?: unknown; membersNeedingConfirm?: unknown } | null
    if (Array.isArray(s?.membersPendingApproval)) reviews += s.membersPendingApproval.length
    if (Array.isArray(s?.membersNeedingConfirm)) reviews += s.membersNeedingConfirm.length
  }
  return { "/uploads": reviews, "/call-lists": suggestions } as Record<string, number>
}
