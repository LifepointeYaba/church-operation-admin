import NextAuth, { CredentialsSignin } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { redirect } from "next/navigation"
import { authConfig } from "./auth.config"
import { prisma } from "./db"
import { verifyPassword } from "./password"
import { audit } from "./audit"
import { homeFor, permissionsOf, type Permission } from "./permissions"

const MAX_ATTEMPTS = 5
const LOCK_MINUTES = 15

class LockedError extends CredentialsSignin {
  code = "locked"
}
class TempExpiredError extends CredentialsSignin {
  code = "temp_expired"
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(creds, request) {
        const email = String(creds?.email ?? "").trim().toLowerCase()
        const password = String(creds?.password ?? "")
        const ip = request?.headers?.get("x-forwarded-for")?.split(",")[0].trim() ?? null
        if (!email || !password) return null
        const user = await prisma.user.findUnique({ where: { email } })
        if (!user) {
          await audit("login_failed", "user", null, null, { email, reason: "unknown email" }, ip, null)
          return null
        }
        const actor = { id: user.id, email: user.email }
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          await audit("login_blocked", "user", user.id, null, { lockedUntil: user.lockedUntil }, ip, actor)
          throw new LockedError()
        }
        const ok = await verifyPassword(user.passwordHash, password)
        if (!ok) {
          const attempts = user.failedAttempts + 1
          const lock = attempts >= MAX_ATTEMPTS
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedAttempts: lock ? 0 : attempts,
              lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
            },
          })
          await audit("login_failed", "user", user.id, null, { attempts, locked: lock }, ip, actor)
          if (lock) throw new LockedError()
          return null
        }
        if (user.mustChangePassword && user.tempPasswordExpiresAt && user.tempPasswordExpiresAt < new Date()) {
          await audit("login_failed", "user", user.id, null, { reason: "temporary password expired", expiredAt: user.tempPasswordExpiresAt }, ip, actor)
          throw new TempExpiredError()
        }
        await prisma.user.update({
          where: { id: user.id },
          data: { failedAttempts: 0, lockedUntil: null, lastLogin: new Date() },
        })
        await audit("login", "user", user.id, null, user.mustChangePassword ? { temporaryPassword: true } : null, ip, actor)
        return { id: user.id, email: user.email, role: user.role }
      },
    }),
  ],
})

export type SessionUser = {
  id: string
  email: string
  name: string | null
  role: string
  themePref: string
  mustChangePassword: boolean
  permissions: Permission[]
}

/** Signed-in user, read fresh from the database so role changes and deletions apply at once. */
async function currentUser(): Promise<SessionUser | null> {
  const session = await auth()
  const id = session?.user?.id
  if (!id) return null
  const user = await prisma.user.findUnique({ where: { id } })
  if (!user) return null
  // Sessions issued before the last password change are no longer valid.
  const loginAt = (session as { loginAt?: number }).loginAt ?? 0
  if (loginAt && loginAt < user.passwordChangedAt.getTime() - 1000) return null
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    themePref: user.themePref,
    mustChangePassword: user.mustChangePassword,
    permissions: permissionsOf(user.role),
  }
}

export const can = (user: Pick<SessionUser, "permissions">, p: Permission) => user.permissions.includes(p)

/**
 * For server components and server actions: redirect to /login when not signed in,
 * and to /change-password while the user still has a generated password.
 */
export async function requireUser(opts: { allowPasswordChange?: boolean } = {}): Promise<SessionUser> {
  const user = await currentUser()
  if (!user) redirect("/login")
  if (user.mustChangePassword && !opts.allowPasswordChange) redirect("/change-password")
  return user
}

/** As requireUser, and the user's role must include `p` (otherwise they're sent to /no-access). */
export async function requirePermission(p: Permission): Promise<SessionUser> {
  const user = await requireUser()
  if (!can(user, p)) redirect(`/no-access?need=${encodeURIComponent(p)}`)
  return user
}

/** For route handlers: returns the user or a 401/403 response. */
export async function requirePermissionApi(p: Permission): Promise<SessionUser | Response> {
  const user = await currentUser()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (user.mustChangePassword) return Response.json({ error: "Change your password first" }, { status: 403 })
  if (!can(user, p)) return Response.json({ error: "Forbidden" }, { status: 403 })
  return user
}

export { homeFor }
