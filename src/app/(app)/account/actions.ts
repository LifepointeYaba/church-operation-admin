"use server"

import { requireUser } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { audit } from "@/lib/audit"
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/password"

export async function changePasswordAction(current: string, next: string, confirm: string) {
  const me = await requireUser()
  const user = await prisma.user.findUniqueOrThrow({ where: { id: me.id } })
  if (!(await verifyPassword(user.passwordHash, current))) {
    await audit("password_change_failed", "user", user.id, null, { reason: "wrong current password" })
    return { ok: false, error: "Current password is incorrect" }
  }
  const problem = passwordProblem(next)
  if (problem) return { ok: false, error: problem }
  if (next !== confirm) return { ok: false, error: "New passwords do not match" }
  if (next === current) return { ok: false, error: "Choose a password different from your current one" }
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(next), passwordChangedAt: new Date(), mustChangePassword: false, tempPasswordExpiresAt: null },
  })
  await audit("password_change", "user", user.id)
  return { ok: true }
}

export async function updateProfileAction(name: string) {
  const me = await requireUser()
  const clean = name.trim().replace(/\s+/g, " ").slice(0, 80) || null
  if (clean === me.name) return { ok: true }
  await prisma.user.update({ where: { id: me.id }, data: { name: clean } })
  await audit("profile_update", "user", me.id, { name: me.name }, { name: clean })
  return { ok: true }
}
