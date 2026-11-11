/**
 * Bootstrap the first Super Admin, or reset a user's password from the command line.
 * Everyone else is added in the app under Users & roles.
 *   npm run setup-admin -- --email you@example.com --password "a long password"
 *   npm run setup-admin -- --email you@example.com --password "new password" --reset
 * ADMIN_EMAIL / ADMIN_PASSWORD env vars work too.
 */
import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { hashPassword, passwordProblem } from "../src/lib/password"

const prisma = new PrismaClient()

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main() {
  const email = (arg("email") ?? process.env.ADMIN_EMAIL ?? "").trim().toLowerCase()
  const password = arg("password") ?? process.env.ADMIN_PASSWORD ?? ""
  const reset = process.argv.includes("--reset")
  if (!email || !password) throw new Error("Provide --email and --password")
  const problem = passwordProblem(password)
  if (problem) throw new Error(problem)

  const passwordHash = await hashPassword(password)
  if (reset) {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) throw new Error(`No user with email ${email}`)
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, failedAttempts: 0, lockedUntil: null, passwordChangedAt: new Date(), mustChangePassword: false, tempPasswordExpiresAt: null },
    })
    await prisma.auditLog.create({ data: { action: "password_reset_cli", entity: "user", entityId: user.id, after: { via: "setup-admin script" } } })
    console.log(`Password reset for ${email}`)
    return
  }
  const existing = await prisma.user.findFirst({ where: { role: "super_admin" } })
  if (existing) {
    throw new Error(`A Super Admin already exists (${existing.email}). Add more users in the app, or use --reset to change a password.`)
  }
  const user = await prisma.user.create({ data: { email, passwordHash, role: "super_admin" } })
  await prisma.auditLog.create({ data: { action: "admin_created", entity: "user", entityId: user.id } })
  console.log(`Super Admin created: ${email}`)
}

main()
  .catch((e) => {
    console.error(e.message ?? e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
