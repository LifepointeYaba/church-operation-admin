"use server"

import { AuthError } from "next-auth"
import { signIn } from "@/lib/auth"

export type LoginState = { error?: string }

export async function loginAction(_: LoginState, form: FormData): Promise<LoginState> {
  const next = String(form.get("next") || "/")
  try {
    await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      redirectTo: next.startsWith("/") && !next.startsWith("//") ? next : "/",
    })
    return {}
  } catch (e) {
    if (e instanceof AuthError) {
      const code = (e as AuthError & { code?: string }).code
      if (code === "locked") return { error: "Too many failed attempts. Login is locked for 15 minutes." }
      if (code === "temp_expired") return { error: "Your temporary password has expired. Ask an admin to generate a new one." }
      return { error: "Email or password is incorrect." }
    }
    throw e
  }
}
