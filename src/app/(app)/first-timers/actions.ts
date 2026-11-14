"use server"

import { requirePermission } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { audit } from "@/lib/audit"
import { refreshData } from "@/lib/revalidate"
import { deleteLink, deleteRegistration, getOrCreateLink } from "@/lib/first-timers"
import { isoDate } from "@/lib/dates"

export async function generateLinkAction(dateIso: string) {
  const user = await requirePermission("attendance.mark")
  try {
    const { link, created } = await getOrCreateLink(dateIso, user.id)
    if (!link.active) await prisma.firstTimerLink.update({ where: { id: link.id }, data: { active: true } })
    if (created) await audit("first_timer_link_create", "first_timer_link", link.id, null, { date: dateIso })
    refreshData()
    return { ok: true as const, date: isoDate(link.serviceDate), created }
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Could not create the link" }
  }
}

export async function setLinkActiveAction(id: number, active: boolean) {
  await requirePermission("attendance.mark")
  const link = await prisma.firstTimerLink.update({ where: { id }, data: { active } })
  await audit(active ? "first_timer_link_open" : "first_timer_link_close", "first_timer_link", id, null, { date: isoDate(link.serviceDate) })
  refreshData()
  return { ok: true as const }
}

export async function deleteRegistrationAction(responseId: number) {
  await requirePermission("attendance.mark")
  try {
    const r = await deleteRegistration(responseId)
    refreshData()
    return { ok: true as const, ...r }
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Could not delete the registration" }
  }
}

export async function deleteLinkAction(linkId: number) {
  await requirePermission("attendance.mark")
  try {
    const r = await deleteLink(linkId)
    refreshData()
    return { ok: true as const, ...r }
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Could not delete the link" }
  }
}
