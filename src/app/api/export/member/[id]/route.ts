import { requirePermissionApi } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { audit } from "@/lib/audit"
import { isoDate } from "@/lib/dates"

/** Everything held about one person (data-subject request). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requirePermissionApi("members.export")
  if (admin instanceof Response) return admin
  const id = Number((await params).id)
  const m = await prisma.member.findUnique({
    where: { id },
    include: {
      teams: { include: { team: true } },
      attendance: { include: { service: true } },
      statusHistory: true,
      followUps: true,
    },
  })
  if (!m) return Response.json({ error: "Not found" }, { status: 404 })
  await audit("export", "member", id)
  const body = {
    exportedAt: new Date().toISOString(),
    member: { ...m, teams: m.teams.map((t) => t.team.name), attendance: m.attendance.map((a) => isoDate(a.service.date)).sort() },
  }
  return new Response(JSON.stringify(body, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="member-${id}.json"` },
  })
}
