"use server"

import { createHash, randomBytes } from "crypto"
import { prisma } from "@/lib/db"
import { audit } from "@/lib/audit"
import { emailConfigured, sendEmail } from "@/lib/email"
import { hashPassword, passwordProblem } from "@/lib/password"

export type ResetState = { message?: string; error?: string; done?: boolean }

const sha = (s: string) => createHash("sha256").update(s).digest("hex")

export async function requestReset(_: ResetState, form: FormData): Promise<ResetState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase()
  const generic = { message: "If that email has an account, a reset link has been sent. It is valid for 1 hour." }
  if (!emailConfigured()) {
    return { error: "Email reset isn’t set up yet. Ask an admin to generate a new password for you from Users & roles." }
  }
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    await audit("password_reset_requested", "user", null, null, { email, reason: "unknown email" }, undefined, null)
    return generic
  }
  const token = randomBytes(32).toString("base64url")
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash: sha(token), expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
  })
  const base = process.env.APP_URL ?? "http://localhost:3000"
  const link = `${base}/reset-password?token=${token}`
  await sendEmail(
    user.email,
    "Reset your LifePointe Admin password",
    `<p>Someone asked to reset the LifePointe Admin password.</p><p><a href="${link}">Choose a new password</a> (valid for 1 hour).</p><p>If this wasn't you, ignore this email.</p>`,
  )
  await audit("password_reset_requested", "user", user.id, null, null, undefined, { id: user.id, email: user.email })
  return generic
}

export async function completeReset(_: ResetState, form: FormData): Promise<ResetState> {
  const token = String(form.get("token") ?? "")
  const password = String(form.get("password") ?? "")
  const confirm = String(form.get("confirm") ?? "")
  const problem = passwordProblem(password)
  if (problem) return { error: problem }
  if (password !== confirm) return { error: "Passwords do not match" }
  const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash: sha(token) } })
  if (!row || row.usedAt || row.expiresAt < new Date()) return { error: "This reset link is invalid or has expired." }
  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: {
        passwordHash: await hashPassword(password), passwordChangedAt: new Date(), failedAttempts: 0, lockedUntil: null,
        mustChangePassword: false, tempPasswordExpiresAt: null,
      },
    }),
    prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
  ])
  const owner = await prisma.user.findUnique({ where: { id: row.userId }, select: { id: true, email: true } })
  await audit("password_reset", "user", row.userId, null, { via: "email link" }, undefined, owner)
  return { done: true, message: "Password updated. You can sign in now." }
}
