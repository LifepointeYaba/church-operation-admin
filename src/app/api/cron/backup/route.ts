import { prisma } from "@/lib/db"
import { audit } from "@/lib/audit"
import { blobConfigured, storeFile } from "@/lib/blob"
import { toCsv } from "@/lib/csv-export"
import { isoDate } from "@/lib/dates"
import { purgeExpiredDeletes } from "@/lib/members"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/** Weekly (Vercel Cron): CSV backup of members + attendance to Blob, purge 30-day soft deletes, trim audit log to 2 years. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const purged = await purgeExpiredDeletes()
  const trimmed = await prisma.auditLog.deleteMany({ where: { at: { lt: new Date(Date.now() - 730 * 86400000) } } })

  let files: string[] = []
  if (blobConfigured()) {
    const members = await prisma.member.findMany({ orderBy: { id: "asc" }, include: { teams: { include: { team: true } } } })
    const membersCsv = toCsv(
      ["id", "first_name", "last_name", "phone", "alt_phone", "email", "address", "gender", "status", "branch", "person_responsible", "teams", "flags", "notes", "deleted_at"],
      members.map((m) => [m.id, m.firstName, m.lastName, m.phone, m.altPhone, m.email, m.address, m.gender, m.status, m.branch, m.personResponsible,
        m.teams.map((t) => t.team.name).join("; "), m.flags.join("; "), m.notes, m.deletedAt?.toISOString()]),
    )
    const att = await prisma.$queryRaw<{ member_id: number; date: Date }[]>`
      SELECT a.member_id, s.date FROM attendance a JOIN services s ON s.id = a.service_id ORDER BY s.date, a.member_id`
    const attCsv = toCsv(["member_id", "date"], att.map((a) => [a.member_id, isoDate(a.date)]))
    const heads = await prisma.serviceHeadcount.findMany({ where: { isCurrent: true }, include: { service: true }, orderBy: { service: { date: "asc" } } })
    const headCsv = toCsv(
      ["date", "workers", "members", "first_timers", "second_timers", "male", "female", "children", "total"],
      heads.map((h) => [isoDate(h.service.date), h.workers, h.members, h.firstTimers, h.secondTimers, h.male, h.female, h.children, h.total]),
    )
    const stamp = new Date().toISOString().slice(0, 10)
    files = (await Promise.all([
      storeFile(`backups/${stamp}`, "members.csv", membersCsv, "text/csv"),
      storeFile(`backups/${stamp}`, "attendance.csv", attCsv, "text/csv"),
      storeFile(`backups/${stamp}`, "headcounts.csv", headCsv, "text/csv"),
    ])).filter((u): u is string => !!u)
  }

  await audit("backup", "system", null, null, { files: files.length, purged, auditTrimmed: trimmed.count })
  return Response.json({ ok: true, files: files.length, purged, auditTrimmed: trimmed.count })
}
