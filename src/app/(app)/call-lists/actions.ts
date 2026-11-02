"use server"

import { requireAdmin } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { audit } from "@/lib/audit"
import { refreshData } from "@/lib/revalidate"
import { setStatus } from "@/lib/members"

export async function decideSuggestionAction(id: number, approve: boolean, toStatus?: string) {
  await requireAdmin()
  const s = await prisma.statusSuggestion.findUniqueOrThrow({ where: { id } })
  if (approve) await setStatus(s.memberId, toStatus || s.toStatus, `Approved suggestion: ${s.reason}`)
  await prisma.statusSuggestion.update({ where: { id }, data: { state: approve ? "approved" : "rejected", decidedAt: new Date(), toStatus: toStatus || s.toStatus } })
  await audit(approve ? "suggestion_approve" : "suggestion_reject", "member", s.memberId, { status: s.fromStatus }, { status: toStatus || s.toStatus })
  refreshData()
  return { ok: true }
}
