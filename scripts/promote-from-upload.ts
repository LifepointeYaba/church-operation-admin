/**
 * One-off: apply the "found again → move up a stage" rule to an attendance upload made
 * before automatic promotion existed. Dry run by default.
 *   npx tsx scripts/promote-from-upload.ts                # latest attendance upload, dry run
 *   npx tsx scripts/promote-from-upload.ts --upload 12    # a specific upload
 *   npx tsx scripts/promote-from-upload.ts --apply        # actually update statuses
 *
 * Promotes people who already existed before the upload, got a new present mark from it
 * (including marks added while merging during review), and whose status has not changed since.
 */
import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { NEXT_STATUS, promoteFoundMembers } from "../src/lib/status-progression"

const prisma = new PrismaClient()
const argValue = (name: string) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main() {
  const apply = process.argv.includes("--apply")
  const uploadId = argValue("upload")
  const upload = uploadId
    ? await prisma.upload.findUnique({ where: { id: Number(uploadId) } })
    : await prisma.upload.findFirst({ where: { kind: "attendance", status: { not: "failed" } }, orderBy: { uploadedAt: "desc" } })
  if (!upload || upload.kind !== "attendance") throw new Error("Attendance upload not found")

  const summary = upload.summary as { serviceDates?: unknown } | null
  const dates = Array.isArray(summary?.serviceDates) ? summary.serviceDates.filter((d): d is string => typeof d === "string") : []
  if (!dates.length) throw new Error(`Upload #${upload.id} has no recorded Sunday dates`)
  const services = await prisma.service.findMany({ where: { date: { in: dates.map((d) => new Date(`${d}T00:00:00.000Z`)) } }, select: { id: true } })

  const candidates = await prisma.member.findMany({
    where: {
      deletedAt: null,
      createdAt: { lt: upload.uploadedAt },
      status: { in: Object.keys(NEXT_STATUS) },
      attendance: { some: { serviceId: { in: services.map((s) => s.id) }, markedAt: { gte: upload.uploadedAt } } },
      statusHistory: { none: { changedAt: { gte: upload.uploadedAt } } },
    },
    select: { id: true, firstName: true, lastName: true, status: true },
    orderBy: [{ status: "asc" }, { firstName: "asc" }],
  })

  console.log(`Upload #${upload.id} “${upload.fileName}” (${upload.uploadedAt.toISOString()}), Sundays: ${dates.join(", ")}`)
  for (const m of candidates) console.log(`  ${`${m.firstName} ${m.lastName}`.trim()}: ${m.status} → ${NEXT_STATUS[m.status]}`)
  console.log(`${candidates.length} people to move up a stage.`)

  if (!apply) {
    console.log("Dry run only. Re-run with --apply to update statuses.")
    return
  }
  const promoted = await prisma.$transaction((tx) =>
    promoteFoundMembers(tx, candidates.map((m) => m.id), `Attended again (backfill for upload #${upload.id})`))
  console.log(`Updated ${promoted} people.`)
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
