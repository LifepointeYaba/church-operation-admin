"use server"

import { AuthError } from "next-auth"
import { redirect } from "next/navigation"
import { requireUser, signIn } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { audit } from "@/lib/audit"
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/password"

export type ChangeState = { error?: string }

/** First sign-in with a generated password: the user picks their own before anything else. */
export async function setOwnPasswordAction(_: ChangeState, form: FormData): Promise<ChangeState> {
  const me = await requireUser({ allowPasswordChange: true })
  if (!me.mustChangePassword) redirect("/")
  const next = String(form.get("password") ?? "")
  const confirm = String(form.get("confirm") ?? "")
  const problem = passwordProblem(next)
  if (problem) return { error: problem }
  if (next !== confirm) return { error: "Passwords do not match" }
  const user = await prisma.user.findUniqueOrThrow({ where: { id: me.id } })
  if (await verifyPassword(user.passwordHash, next)) return { error: "Choose a new password, not the temporary one" }
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(next), passwordChangedAt: new Date(), mustChangePassword: false, tempPasswordExpiresAt: null },
  })
  await audit("password_set", "user", user.id, null, { replaced: "temporary password" })
  // The password change ends the old session; sign straight back in with the new password.
  try {
    await signIn("credentials", { email: user.email, password: next, redirectTo: "/" })
  } catch (e) {
    if (e instanceof AuthError) redirect("/login")
    throw e
  }
  return {}
}
