"use server"

import { requireAdmin } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { audit } from "@/lib/audit"
import { refreshData } from "@/lib/revalidate"
import { checkServiceDate, fromIso, isoDate } from "@/lib/dates"

export async function ensureServiceAction(dateIso: string) {
  await requireAdmin()
  const d = fromIso(dateIso)
  if (!d) return { ok: false as const, error: "Invalid date" }
  const c = checkServiceDate(d)
  if (!c.ok) return { ok: false as const, error: c.reason }
  const s = await prisma.service.upsert({ where: { date: d }, create: { date: d }, update: {} })
  return { ok: true as const, id: s.id }
}

export async function toggleAttendanceAction(serviceId: number, memberId: number, present: boolean) {
  await requireAdmin()
  const svc = await prisma.service.findUniqueOrThrow({ where: { id: serviceId } })
  if (present) {
    await prisma.attendance.upsert({
      where: { memberId_serviceId: { memberId, serviceId } },
      create: { memberId, serviceId },
      update: {},
    })
    if (!svc.recordTaken) await prisma.service.update({ where: { id: serviceId }, data: { recordTaken: true } })
  } else {
    await prisma.attendance.deleteMany({ where: { memberId, serviceId } })
  }
  await audit(present ? "attendance_mark" : "attendance_unmark", "member", memberId, null, { date: isoDate(svc.date) })
  await prisma.$executeRaw`
    UPDATE members SET first_seen_service_id = (
      SELECT a.service_id FROM attendance a JOIN services s ON s.id = a.service_id
      WHERE a.member_id = ${memberId} ORDER BY s.date LIMIT 1)
    WHERE id = ${memberId}`
  refreshData()
  return { ok: true as const }
}

export async function setRecordTakenAction(serviceId: number, recordTaken: boolean) {
  await requireAdmin()
  const s = await prisma.service.update({ where: { id: serviceId }, data: { recordTaken } })
  await audit("service_update", "service", serviceId, null, { date: isoDate(s.date), recordTaken })
  refreshData()
  return { ok: true as const }
}
