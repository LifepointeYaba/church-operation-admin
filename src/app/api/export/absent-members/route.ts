import { requirePermissionApi } from "@/lib/auth"
import { audit } from "@/lib/audit"
import { toCsv } from "@/lib/csv-export"
import { absentMembers, type AbsentParams } from "@/lib/metrics/absent"
import { getSettings } from "@/lib/settings"
import { displayPhone } from "@/lib/phone"
import { formatDate } from "@/lib/dates"

export async function GET(req: Request) {
  const admin = await requirePermissionApi("dashboard.view")
  if (admin instanceof Response) return admin
  const sp = Object.fromEntries(new URL(req.url).searchParams) as AbsentParams
  const settings = await getSettings()
  const result = await absentMembers(sp, settings.statuses)
  if (!result) return Response.json({ error: "No attendance yet" }, { status: 404 })
  const { people, from, to } = result

  const headers = ["Name", "Phone", "Status", "Gender", "Team", "Person responsible", "Last came", "Sundays missed since"]
  const rows = people.map((m) => [
    `${m.firstName} ${m.lastName}`.trim(),
    displayPhone(m.phone),
    m.status,
    m.gender ?? "",
    m.teams.join(", "),
    m.personResponsible ?? "",
    m.lastDate ? formatDate(m.lastDate, "long") : "",
    m.lastRn! - 1,
  ])
  await audit("export", "absent_members", `${from}_${to}`, null, { from, to, team: result.team, status: result.status, gender: result.gender, count: rows.length, format: "csv" })
  const name = from === to ? `absent-last-came-${to}.csv` : `absent-last-came-${from}-to-${to}.csv`
  return new Response(toCsv(headers, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "X-Row-Count": String(rows.length),
    },
  })
}
