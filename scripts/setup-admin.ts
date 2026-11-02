/**
 * Create the single Super Admin, or reset its password.
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

  const existing = await prisma.user.findFirst({ where: { role: "super_admin" } })
  const passwordHash = await hashPassword(password)
  if (existing && !reset) {
    throw new Error(`A Super Admin already exists (${existing.email}). Use --reset to change the password.`)
  }
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { email, passwordHash, failedAttempts: 0, lockedUntil: null, passwordChangedAt: new Date() },
    })
    await prisma.auditLog.create({ data: { action: "password_reset_cli", entity: "user", entityId: existing.id } })
    console.log(`Super Admin password reset for ${email}`)
  } else {
    const user = await prisma.user.create({ data: { email, passwordHash, role: "super_admin" } })
    await prisma.auditLog.create({ data: { action: "admin_created", entity: "user", entityId: user.id } })
    console.log(`Super Admin created: ${email}`)
  }
}

main()
  .catch((e) => {
    console.error(e.message ?? e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
