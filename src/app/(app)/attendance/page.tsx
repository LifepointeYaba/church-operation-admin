import { redirect } from "next/navigation"
import { requirePermission } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { fromIso, isoDate, lastSunday } from "@/lib/dates"
import { getSettings } from "@/lib/settings"
import { MarkAttendance } from "./mark-attendance"

export const metadata = { title: "Mark attendance" }

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  await requirePermission("attendance.mark")
  const { date } = await searchParams
  const sunday = isoDate(lastSunday())
  const chosen = date && fromIso(date) ? date : sunday
  if (date && !fromIso(date)) redirect("/attendance")
  const [service, services, members, settings] = await Promise.all([
    prisma.service.findUnique({ where: { date: new Date(`${chosen}T00:00:00Z`) } }),
    prisma.service.findMany({ orderBy: { date: "desc" }, select: { date: true } }),
    prisma.member.findMany({
      where: { deletedAt: null },
      select: { id: true, firstName: true, lastName: true, phone: true, status: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    getSettings(),
  ])
  const present = service
    ? (await prisma.attendance.findMany({ where: { serviceId: service.id }, select: { memberId: true } })).map((a) => a.memberId)
    : []
  const dates = [...new Set([sunday, ...services.map((s) => isoDate(s.date))])].sort().reverse()
  return (
    <MarkAttendance
      key={chosen}
      date={chosen}
      dates={dates}
      serviceId={service?.id ?? null}
      recordTaken={service?.recordTaken ?? true}
      members={members.map((m) => ({ id: m.id, name: `${m.firstName} ${m.lastName}`.trim(), phone: m.phone, status: m.status }))}
      initialPresent={present}
      statuses={settings.statuses}
    />
  )
}
