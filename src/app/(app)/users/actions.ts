"use server"

import { z } from "zod"
import { Prisma } from "@prisma/client"
import { requirePermission, type SessionUser } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { audit } from "@/lib/audit"
import { generateTempPassword, hashPassword, TEMP_PASSWORD_MINUTES } from "@/lib/password"
import { canManageRole, isRole, roleLabel } from "@/lib/permissions"

type Fail = { ok: false; error: string }
type Issued = { ok: true; data: { email: string; password: string; expiresAt: string } }

const fail = (error: string): Fail => ({ ok: false, error })

const userInput = z.object({
  name: z.string().trim().max(80).transform((v) => v.replace(/\s+/g, " ") || null),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  role: z.string().refine(isRole, "Choose a role"),
})

/** What goes in the audit log about a user: never the password hash. */
const snapshot = (u: { email: string; name: string | null; role: string }) => ({ email: u.email, name: u.name, role: u.role })

async function issueTempPassword() {
  const password = generateTempPassword()
  const expiresAt = new Date(Date.now() + TEMP_PASSWORD_MINUTES * 60_000)
  return { password, expiresAt, passwordHash: await hashPassword(password) }
}

/** Loads the target and checks the signed-in user may manage it. */
async function target(me: SessionUser, id: string) {
  const user = await prisma.user.findUnique({ where: { id } })
  if (!user) return fail("That user no longer exists")
  if (user.id === me.id) return fail("You can’t do this to your own account. Use My account instead.")
  if (!canManageRole(me.role, user.role)) return fail("Only a Super Admin can manage Super Admin accounts")
  return user
}

export async function createUserAction(input: { name: string; email: string; role: string }): Promise<Issued | Fail> {
  const me = await requirePermission("users.manage")
  const v = userInput.safeParse(input)
  if (!v.success) return fail(v.error.issues[0].message)
  if (!canManageRole(me.role, v.data.role)) return fail("Only a Super Admin can create another Super Admin")
  const temp = await issueTempPassword()
  try {
    const user = await prisma.user.create({
      data: {
        email: v.data.email, name: v.data.name, role: v.data.role, passwordHash: temp.passwordHash,
        mustChangePassword: true, tempPasswordExpiresAt: temp.expiresAt, createdById: me.id,
      },
    })
    await audit("user_create", "user", user.id, null, { ...snapshot(user), tempPasswordExpiresAt: temp.expiresAt })
    return { ok: true, data: { email: user.email, password: temp.password, expiresAt: temp.expiresAt.toISOString() } }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return fail("A user with that email already exists")
    throw e
  }
}

export async function updateUserAction(id: string, input: { name: string; role: string }): Promise<{ ok: true } | Fail> {
  const me = await requirePermission("users.manage")
  const user = await target(me, id)
  if ("ok" in user) return user
  const v = userInput.pick({ name: true, role: true }).safeParse(input)
  if (!v.success) return fail(v.error.issues[0].message)
  if (!canManageRole(me.role, v.data.role)) return fail("Only a Super Admin can give someone the Super Admin role")
  if (user.role === "super_admin" && v.data.role !== "super_admin") {
    const others = await prisma.user.count({ where: { role: "super_admin", id: { not: user.id } } })
    if (!others) return fail("Keep at least one Super Admin")
  }
  const updated = await prisma.user.update({ where: { id }, data: { name: v.data.name, role: v.data.role } })
  await audit(user.role !== updated.role ? "user_role_change" : "user_update", "user", id, snapshot(user), snapshot(updated))
  return { ok: true }
}

/** New temporary password: signs the user out everywhere and makes them choose a new one. */
export async function regeneratePasswordAction(id: string): Promise<Issued | Fail> {
  const me = await requirePermission("users.manage")
  const user = await target(me, id)
  if ("ok" in user) return user
  const temp = await issueTempPassword()
  await prisma.user.update({
    where: { id },
    data: {
      passwordHash: temp.passwordHash, mustChangePassword: true, tempPasswordExpiresAt: temp.expiresAt,
      passwordChangedAt: new Date(), failedAttempts: 0, lockedUntil: null,
    },
  })
  await audit("user_password_regenerate", "user", id, { email: user.email, wasLocked: !!(user.lockedUntil && user.lockedUntil > new Date()) }, { tempPasswordExpiresAt: temp.expiresAt })
  return { ok: true, data: { email: user.email, password: temp.password, expiresAt: temp.expiresAt.toISOString() } }
}

export async function deleteUserAction(id: string): Promise<{ ok: true } | Fail> {
  const me = await requirePermission("users.manage")
  const user = await target(me, id)
  if ("ok" in user) return user
  if (user.role === "super_admin") {
    const others = await prisma.user.count({ where: { role: "super_admin", id: { not: user.id } } })
    if (!others) return fail(`Keep at least one ${roleLabel("super_admin")}`)
  }
  await prisma.user.delete({ where: { id } })
  await audit("user_delete", "user", id, { ...snapshot(user), lastLogin: user.lastLogin, createdAt: user.createdAt }, null)
  return { ok: true }
}
