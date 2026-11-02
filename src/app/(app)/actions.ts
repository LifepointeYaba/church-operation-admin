"use server"

import { signOut } from "@/lib/auth"
import { requireAdmin } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { audit } from "@/lib/audit"

export async function logoutAction() {
  const admin = await requireAdmin()
  await audit("logout", "user", admin.id)
  await signOut({ redirectTo: "/login" })
}

export async function saveThemePref(theme: string) {
  const admin = await requireAdmin()
  if (!["light", "dark", "system"].includes(theme)) return
  await prisma.user.update({ where: { id: admin.id }, data: { themePref: theme } })
}
