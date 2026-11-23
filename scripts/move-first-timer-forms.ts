/**
 * One-off: people who filled an old first-timer link on a later Sunday (the link stayed open for 7 days)
 * were saved against the link's Sunday. Move them to the Sunday they actually came:
 *  - their form answers move to that Sunday's link (created if missing)
 *  - the wrong "present" mark on the old Sunday is removed, so they're present only on the day they came
 *  - their first-seen Sunday is recalculated, and a Second Timer promotion caused by the wrong mark is undone
 * Only people created by that form (not matched to an existing record) are moved.
 * Run `scripts/recount-headcounts.ts` afterwards to bring register-based headcounts in step.
 * Dry run by default.
 *   npx tsx --env-file-if-exists=.env.local scripts/move-first-timer-forms.ts 2026-11-15 2026-11-22
 *   npx tsx --env-file-if-exists=.env.local scripts/move-first-timer-forms.ts 2026-11-15 2026-11-22 --apply
 */
import "dotenv/config"
import { randomBytes } from "node:crypto"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const LAGOS_MS = 60 * 60 * 1000
const toDate = (iso: string) => new Date(`${iso}T00:00:00.000Z`)
const lagosDay = (d: Date) => new Date(d.getTime() + LAGOS_MS).toISOString().slice(0, 10)

async function main() {
  const [fromIso, toIso] = process.argv.slice(2).filter((a) => !a.startsWith("--"))
  const apply = process.argv.includes("--apply")
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromIso ?? "") || !/^\d{4}-\d{2}-\d{2}$/.test(toIso ?? "")) {
    throw new Error("Usage: move-first-timer-forms.ts <link Sunday> <actual Sunday> [--apply]")
  }
  const fromLink = await prisma.firstTimerLink.findUnique({ where: { serviceDate: toDate(fromIso) }, include: { responses: { include: { member: true } } } })
  if (!fromLink) throw new Error(`No first-timer link for ${fromIso}`)
  const fromService = await prisma.service.findUnique({ where: { date: toDate(fromIso) } })
  const toService = await prisma.service.findUnique({ where: { date: toDate(toIso) } })
  if (!fromService || !toService) throw new Error("Both Sundays must exist as services")

  const moving = fromLink.responses.filter((r) => lagosDay(r.createdAt) === toIso && !r.matchedExisting && r.memberId)
  if (!moving.length) return console.log(`No new first timers filled the ${fromIso} link on ${toIso}.`)

  console.log(`${moving.length} people filled the ${fromIso} link on ${toIso}:`)
  for (const r of moving) {
    const m = r.member!
    const att = await prisma.attendance.findMany({ where: { memberId: m.id }, include: { service: true } })
    const dates = att.map((a) => a.service.date.toISOString().slice(0, 10)).sort()
    const restore = m.status === "Second Timer" && dates.filter((d) => d !== fromIso).length === 1
    console.log(`  #${m.id} ${m.firstName} ${m.lastName} · ${m.status} · present ${dates.join(", ")}${dates.includes(toIso) ? "" : ` (will add ${toIso})`}${restore ? " · status back to First Timer" : ""}`)
  }
  if (!apply) return console.log("\nDry run. Re-run with --apply to save.")

  await prisma.$transaction(async (tx) => {
    const toLink = await tx.firstTimerLink.upsert({
      where: { serviceDate: toDate(toIso) },
      create: { serviceDate: toDate(toIso), token: randomBytes(9).toString("base64url") },
      update: {},
    })
    for (const r of moving) {
      const memberId = r.memberId!
      await tx.firstTimerResponse.update({ where: { id: r.id }, data: { linkId: toLink.id } })
      await tx.attendance.deleteMany({ where: { memberId, serviceId: fromService.id } })
      await tx.attendance.upsert({
        where: { memberId_serviceId: { memberId, serviceId: toService.id } },
        create: { memberId, serviceId: toService.id },
        update: {},
      })
      await tx.$executeRaw`
        UPDATE members SET first_seen_service_id = (
          SELECT a.service_id FROM attendance a JOIN services s ON s.id = a.service_id
          WHERE a.member_id = ${memberId} ORDER BY s.date LIMIT 1)
        WHERE id = ${memberId}`
      const m = await tx.member.findUniqueOrThrow({ where: { id: memberId }, include: { _count: { select: { attendance: true } } } })
      if (m.status === "Second Timer" && m._count.attendance === 1) {
        await tx.member.update({ where: { id: memberId }, data: { status: "First Timer" } })
        await tx.statusHistory.create({
          data: { memberId, old: "Second Timer", new: "First Timer", reason: `Corrected: first came ${toIso}, not ${fromIso} (first-timer form)` },
        })
      }
      await tx.auditLog.create({
        data: { action: "first_timer_moved", entity: "member", entityId: String(memberId), before: { date: fromIso }, after: { date: toIso, responseId: r.id } },
      })
    }
  }, { timeout: 60_000, maxWait: 10_000 })
  console.log(`\nMoved ${moving.length} people to ${toIso}. Now run scripts/recount-headcounts.ts.`)
}

main().finally(() => prisma.$disconnect())
