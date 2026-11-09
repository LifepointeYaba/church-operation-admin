import type { PrismaClient } from "@prisma/client"
import { registerBreakdownNow } from "./metrics/breakdown"
import { computeTotal } from "./import/headcount"

/** Fields of the weekly headcount that come from the attendance register. Children are always entered by hand. */
export const REGISTER_FIELDS = ["workers", "members", "firstTimers", "secondTimers", "male", "female"] as const

export type HeadcountSyncResult = { created: string[]; refreshed: string[]; kept: string[] }

/**
 * Fill each Sunday's weekly headcount from the attendance register after an upload.
 * - No headcount yet → create one (children 0).
 * - Headcount that was itself filled from an upload → refresh the register numbers, keep children.
 * - Headcount entered by hand or from the Chart sheet → leave it alone.
 */
export async function syncHeadcountsFromRegister(db: PrismaClient, dates: string[], uploadId: number): Promise<HeadcountSyncResult> {
  const res: HeadcountSyncResult = { created: [], refreshed: [], kept: [] }
  const sorted = [...new Set(dates)].sort()
  if (!sorted.length) return res
  const register = await registerBreakdownNow(sorted[0], sorted.at(-1)!, {})
  for (const date of sorted) {
    const numbers = register[date]
    if (!numbers) continue
    const service = await db.service.findUnique({
      where: { date: new Date(`${date}T00:00:00.000Z`) },
      select: { id: true, headcounts: { where: { isCurrent: true }, include: { upload: { select: { kind: true } } } } },
    })
    if (!service) continue
    const values = Object.fromEntries(REGISTER_FIELDS.map((k) => [k, numbers[k] as number])) as Record<(typeof REGISTER_FIELDS)[number], number>
    const total = computeTotal(values)
    const current = service.headcounts[0]
    if (!current) {
      await db.serviceHeadcount.create({ data: { ...values, children: 0, total, serviceId: service.id, uploadId } })
      res.created.push(date)
    } else if (current.upload?.kind === "attendance") {
      await db.serviceHeadcount.update({ where: { id: current.id }, data: { ...values, total, uploadId } })
      res.refreshed.push(date)
    } else {
      res.kept.push(date)
    }
  }
  return res
}
