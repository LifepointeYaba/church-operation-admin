"use server"

import { can, requirePermission, requireUser } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { audit } from "@/lib/audit"
import { refreshData } from "@/lib/revalidate"
import { getSettings } from "@/lib/settings"
import { cleanName } from "@/lib/keys"
import { knownSundayLabels, sundayDetails } from "@/lib/sunday-people"

const ISO = /^\d{4}-\d{2}-\d{2}$/

/** People behind a Sunday's numbers (first/second timers, returners), for the insight cards. */
export async function sundayDetailsAction(dateIso: string) {
  const user = await requireUser()
  if (!can(user, "members.view") || !ISO.test(dateIso)) return null
  const settings = await getSettings()
  return sundayDetails(dateIso, settings.atRiskWeeks)
}

export async function sundayLabelsAction() {
  await requireUser()
  return knownSundayLabels()
}

/** Tag a Sunday ("Flicks & Talks"). An empty label makes it a regular Sunday again. */
export async function setSundayLabelAction(dateIso: string, label: string) {
  await requirePermission("headcount.manage")
  if (!ISO.test(dateIso)) return { ok: false, error: "Invalid date" }
  const next = cleanName(label).slice(0, 60) || null
  const service = await prisma.service.findUnique({ where: { date: new Date(`${dateIso}T00:00:00Z`) } })
  if (!service) return { ok: false, error: "No service recorded for that Sunday yet" }
  if (service.label === next) return { ok: true }
  await prisma.service.update({ where: { id: service.id }, data: { label: next } })
  await audit("service_label", "service", dateIso, { label: service.label }, { label: next })
  refreshData()
  return { ok: true }
}
