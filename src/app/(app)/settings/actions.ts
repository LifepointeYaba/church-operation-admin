"use server"

import { z } from "zod"
import { requireAdmin } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { audit } from "@/lib/audit"
import { refreshData } from "@/lib/revalidate"
import { getSettings, saveSetting } from "@/lib/settings"
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/password"
import { cleanName } from "@/lib/keys"

const thresholds = z.object({
  atRiskWeeks: z.coerce.number().int().min(1).max(26),
  inactiveWeeks: z.coerce.number().int().min(2).max(52),
  minVisitsForRisk: z.coerce.number().int().min(1).max(20),
  workerMissWeeks: z.coerce.number().int().min(1).max(12),
})

export async function saveThresholdsAction(input: z.input<typeof thresholds>) {
  await requireAdmin()
  const v = thresholds.safeParse(input)
  if (!v.success) return { ok: false, error: "Enter whole numbers in range" }
  if (v.data.inactiveWeeks <= v.data.atRiskWeeks) return { ok: false, error: "Inactive must be more weeks than at risk" }
  const before = await getSettings()
  for (const [k, val] of Object.entries(v.data)) await saveSetting(k as keyof typeof v.data, val)
  await audit("settings_update", "settings", "thresholds", before, v.data)
  refreshData()
  return { ok: true }
}

export async function saveStatusesAction(list: string[]) {
  await requireAdmin()
  const statuses = [...new Set(list.map(cleanName).filter(Boolean))]
  if (!statuses.length) return { ok: false, error: "Keep at least one status" }
  const inUse = await prisma.member.groupBy({ by: ["status"], where: { status: { notIn: statuses } }, _count: true })
  if (inUse.length) return { ok: false, error: `Still in use: ${inUse.map((u) => `${u.status} (${u._count})`).join(", ")}. Move those people first.` }
  const before = (await getSettings()).statuses
  await saveSetting("statuses", statuses)
  await audit("settings_update", "settings", "statuses", before, statuses)
  refreshData()
  return { ok: true }
}

export async function renameTeamAction(id: number, name: string) {
  await requireAdmin()
  const n = cleanName(name)
  if (!n) return { ok: false, error: "Enter a name" }
  const before = await prisma.team.findUniqueOrThrow({ where: { id } })
  const clash = await prisma.team.findFirst({ where: { name: { equals: n, mode: "insensitive" }, id: { not: id } } })
  if (clash) {
    // Renaming onto an existing team merges the two.
    await prisma.$executeRaw`INSERT INTO member_teams (member_id, team_id) SELECT member_id, ${clash.id} FROM member_teams WHERE team_id = ${id} ON CONFLICT DO NOTHING`
    await prisma.team.delete({ where: { id } })
    await audit("team_merge", "team", clash.id, before, { mergedInto: clash.name })
  } else {
    await prisma.team.update({ where: { id }, data: { name: n } })
    await audit("team_rename", "team", id, before, { name: n })
  }
  refreshData()
  return { ok: true }
}

export async function addTeamAction(name: string) {
  await requireAdmin()
  const n = cleanName(name)
  if (!n) return { ok: false, error: "Enter a name" }
  await prisma.team.upsert({ where: { name: n }, create: { name: n }, update: {} })
  await audit("team_create", "team", n)
  refreshData()
  return { ok: true }
}

export async function deleteTeamAction(id: number) {
  await requireAdmin()
  const t = await prisma.team.delete({ where: { id } })
  await audit("team_delete", "team", id, t, null)
  refreshData()
  return { ok: true }
}

export async function changePasswordAction(current: string, next: string, confirm: string) {
  const admin = await requireAdmin()
  const user = await prisma.user.findUniqueOrThrow({ where: { id: admin.id } })
  if (!(await verifyPassword(user.passwordHash, current))) return { ok: false, error: "Current password is incorrect" }
  const problem = passwordProblem(next)
  if (problem) return { ok: false, error: problem }
  if (next !== confirm) return { ok: false, error: "New passwords do not match" }
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next), passwordChangedAt: new Date() } })
  await audit("password_change", "user", user.id)
  return { ok: true }
}
