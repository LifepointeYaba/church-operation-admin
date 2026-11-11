import { requirePermissionApi } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { audit } from "@/lib/audit"
import { toCsv } from "@/lib/csv-export"
import { activityOf, memberStats, referenceService } from "@/lib/metrics"
import { getSettings } from "@/lib/settings"
import { isoDate } from "@/lib/dates"

export async function GET(req: Request) {
  const admin = await requirePermissionApi("members.export")
  if (admin instanceof Response) return admin
  const ids = new URL(req.url).searchParams.get("ids")?.split(",").filter(Boolean).map(Number)
  const ref = await referenceService()
  const settings = await getSettings()
  const stats = ref ? await memberStats(isoDate(ref.date), {}) : []
  const extra = new Map((await prisma.member.findMany({ select: { id: true, email: true, address: true, flags: true } })).map((m) => [m.id, m]))
  const rows = stats.filter((m) => !ids?.length || ids.includes(m.id))
  await audit("export", "members", null, null, { count: rows.length })
  const csv = toCsv(
    ["ID", "First Name", "Last Name", "Phone", "Email", "Address", "Gender", "Status", "Teams", "Person Responsible", "Activity", "Visits", "Streak", "Last Attended", "First Seen", "Flags"],
    rows.map((m) => [m.id, m.firstName, m.lastName, m.phone, extra.get(m.id)?.email, extra.get(m.id)?.address, m.gender, m.status, m.teams.join(", "),
      m.personResponsible, activityOf(m, settings), m.visits, m.streak, m.lastDate, m.firstDate, extra.get(m.id)?.flags.join(" ")]),
  )
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="members-${isoDate(new Date())}.csv"` },
  })
}
