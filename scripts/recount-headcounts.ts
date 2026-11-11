/**
 * One-off: recount the weekly headcount of every Sunday that follows the attendance register
 * (filled from an upload or by marking attendance) so it matches who is marked present.
 * Children and guests/pastors are kept and stay in the total. Headcounts typed in by hand or from the Chart sheet are only reported, never changed.
 * Run after `npm run db:migrate`. Dry run by default.
 *   npx tsx --env-file-if-exists=.env.local scripts/recount-headcounts.ts           # show what would change
 *   npx tsx --env-file-if-exists=.env.local scripts/recount-headcounts.ts --apply   # save the changes
 */
import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { REGISTER_FIELDS, followsRegister } from "../src/lib/headcount-sync"
import { registerBreakdownNow } from "../src/lib/metrics/breakdown"
import { computeTotal } from "../src/lib/import/headcount"
import { isoDate } from "../src/lib/dates"

const prisma = new PrismaClient()

async function main() {
  const apply = process.argv.includes("--apply")
  const services = await prisma.service.findMany({
    where: { recordTaken: true },
    orderBy: { date: "asc" },
    select: { date: true, headcounts: { where: { isCurrent: true }, include: { upload: { select: { kind: true } } } } },
  })
  if (!services.length) return console.log("No Sundays with attendance.")
  const register = await registerBreakdownNow(isoDate(services[0].date), isoDate(services.at(-1)!.date), {}, prisma)
  let changed = 0
  for (const svc of services) {
    const date = isoDate(svc.date)
    const h = svc.headcounts[0]
    const r = register[date]
    if (!h || !r) continue
    const values = Object.fromEntries(REGISTER_FIELDS.map((k) => [k, r[k] as number])) as Record<(typeof REGISTER_FIELDS)[number], number>
    const total = computeTotal({ ...values, children: h.children, guests: h.guests })
    const diffs = [...REGISTER_FIELDS, "total" as const]
      .filter((k) => h[k] !== (k === "total" ? total : values[k]))
      .map((k) => `${k} ${h[k]}→${k === "total" ? total : values[k]}`)
    if (!diffs.length) continue
    if (!followsRegister(h)) {
      console.log(`${date}  (typed in / Chart sheet, left alone; register has ${diffs.join(", ")})`)
      continue
    }
    console.log(`${date}  ${diffs.join(", ")}`)
    changed++
    if (apply) await prisma.serviceHeadcount.update({ where: { id: h.id }, data: { ...values, total, fromRegister: true } })
  }
  console.log(changed ? `${changed} Sunday(s) ${apply ? "updated" : "would be updated — run with --apply to save"}.` : "All register headcounts already match.")
}

main().finally(() => prisma.$disconnect())
