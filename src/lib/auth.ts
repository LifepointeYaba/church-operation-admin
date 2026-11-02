import NextAuth, { CredentialsSignin } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { redirect } from "next/navigation"
import { authConfig } from "./auth.config"
import { prisma } from "./db"
import { verifyPassword } from "./password"
import { audit } from "./audit"

const MAX_ATTEMPTS = 5
const LOCK_MINUTES = 15

class LockedError extends CredentialsSignin {
  code = "locked"
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
          await audit("login_failed", "user", null, null, { email, reason: "unknown email" }, ip)
          return null
        }
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          await audit("login_blocked", "user", user.id, null, { lockedUntil: user.lockedUntil }, ip)
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
          await audit("login_failed", "user", user.id, null, { attempts, locked: lock }, ip)
          if (lock) throw new LockedError()
          return null
        }
        await prisma.user.update({
          where: { id: user.id },
          data: { failedAttempts: 0, lockedUntil: null, lastLogin: new Date() },
        })
        await audit("login", "user", user.id, null, null, ip)
        return { id: user.id, email: user.email, role: user.role }
      },
    }),
  ],
})

export type Admin = { id: string; email: string; themePref: string }

async function currentAdmin(): Promise<Admin | null> {
  const session = await auth()
  const id = session?.user?.id
  if (!id) return null
  const user = await prisma.user.findUnique({ where: { id } })
  if (!user || user.role !== "super_admin") return null
  // Sessions issued before the last password change are no longer valid.
  const loginAt = (session as { loginAt?: number }).loginAt ?? 0
  if (loginAt && loginAt < user.passwordChangedAt.getTime() - 1000) return null
  return { id: user.id, email: user.email, themePref: user.themePref }
}

/** For server components and server actions: redirect to /login when not signed in. */
export async function requireAdmin(): Promise<Admin> {
  const admin = await currentAdmin()
  if (!admin) redirect("/login")
  return admin
}

/** For route handlers: returns the admin or a 401 response. */
export async function requireAdminApi(): Promise<Admin | Response> {
  const admin = await currentAdmin()
  return admin ?? Response.json({ error: "Unauthorized" }, { status: 401 })
}
