/**
 * Seed the database from the church's CSV files (idempotent — safe to re-run).
 *   npm run db:seed
 * Reads data/just_attendance.csv and data/chart_2026.csv (paths can be overridden with
 * ATTENDANCE_CSV / HEADCOUNT_CSV).
 */
import "dotenv/config"
import { existsSync, readFileSync } from "fs"
import { PrismaClient } from "@prisma/client"
import { readGrid } from "../src/lib/import/csv"
import { parseAttendanceGrid } from "../src/lib/import/attendance"
import { parseHeadcountGrid } from "../src/lib/import/headcount"
import { applyAttendanceImport, applyHeadcounts } from "../src/lib/import/apply"
import { DEFAULT_SETTINGS } from "../src/lib/settings"

const prisma = new PrismaClient()

async function main() {
  const attPath = process.env.ATTENDANCE_CSV ?? "data/just_attendance.csv"
  const hcPath = process.env.HEADCOUNT_CSV ?? "data/chart_2026.csv"
  if (!existsSync(attPath)) throw new Error(`Missing ${attPath}`)

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.setting.upsert({ where: { key }, create: { key, value }, update: {} })
  }

  console.log(`Importing ${attPath} …`)
  const parsed = parseAttendanceGrid(readGrid(readFileSync(attPath, "utf8")))
  const sum = await applyAttendanceImport(prisma, parsed, { createUnmatchedNoPhone: true })
  const upload = await prisma.upload.create({
    data: {
      kind: "attendance",
      fileName: "just_attendance.csv (seed)",
      rowsOk: parsed.people.length,
      rowsFailed: sum.rejected.length,
      summary: sum,
    },
  })
  await prisma.auditLog.create({ data: { action: "import", entity: "upload", entityId: String(upload.id), after: sum } })
  console.log(sum)

  if (existsSync(hcPath)) {
    console.log(`Importing ${hcPath} …`)
    const hc = parseHeadcountGrid(readGrid(readFileSync(hcPath, "utf8")))
    const hcUpload = await prisma.upload.create({
      data: { kind: "headcount", fileName: "Chart 2026 (seed)", rowsOk: 0, rowsFailed: 0 },
    })
    const res = await applyHeadcounts(prisma, hc.rows, hc.notes, { uploadId: hcUpload.id })
    await prisma.upload.update({
      where: { id: hcUpload.id },
      data: { rowsOk: res.saved, rowsFailed: res.failed, summary: { ...res, skippedBlocks: hc.skippedBlocks } },
    })
    await prisma.auditLog.create({ data: { action: "import", entity: "upload", entityId: String(hcUpload.id), after: res } })
    console.log(res, hc.skippedBlocks)
  }

  const [members, services, attendance, headcounts, flagged] = await Promise.all([
    prisma.member.count(),
    prisma.service.count(),
    prisma.attendance.count(),
    prisma.serviceHeadcount.count({ where: { isCurrent: true } }),
    prisma.member.count({ where: { NOT: { flags: { isEmpty: true } } } }),
  ])
  console.log({ members, services, attendance, headcounts, flagged })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
