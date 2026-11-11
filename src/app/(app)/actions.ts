"use server"

import { signOut } from "@/lib/auth"
import { requireUser } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { audit } from "@/lib/audit"

export async function logoutAction() {
  const user = await requireUser({ allowPasswordChange: true })
  await audit("logout", "user", user.id)
  await signOut({ redirectTo: "/login" })
}

export async function saveThemePref(theme: string) {
  const user = await requireUser()
  if (!["light", "dark", "system"].includes(theme)) return
  await prisma.user.update({ where: { id: user.id }, data: { themePref: theme } })
}
