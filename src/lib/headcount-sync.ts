import type { Prisma, PrismaClient } from "@prisma/client"
import { registerBreakdownNow, type Breakdown } from "./metrics/breakdown"
import { computeTotal } from "./import/headcount"
import { isoDate } from "./dates"

/** Fields of the weekly headcount that come from the attendance register. Children are always entered by hand. */
export const REGISTER_FIELDS = ["workers", "members", "firstTimers", "secondTimers", "male", "female"] as const
type RegisterValues = Record<(typeof REGISTER_FIELDS)[number], number>

export type HeadcountSyncResult = { created: string[]; refreshed: string[]; kept: string[] }

/** A headcount that follows the register (filled from an upload or by marking attendance), as opposed to one typed in or from the Chart sheet. */
export function followsRegister(h: { fromRegister: boolean; upload?: { kind: string } | null }) {
  return h.fromRegister || h.upload?.kind === "attendance"
}

const pick = (b: Breakdown): RegisterValues =>
  Object.fromEntries(REGISTER_FIELDS.map((k) => [k, b[k] as number])) as RegisterValues

const ZERO: Breakdown = { workers: 0, members: 0, firstTimers: 0, secondTimers: 0, total: 0, male: 0, female: 0, children: null }

/**
 * Fill each Sunday's weekly headcount from the attendance register after an upload.
 * - No headcount yet → create one (children 0).
 * - Headcount that follows the register → refresh the register numbers, keep children.
 * - Headcount entered by hand or from the Chart sheet → leave it alone.
 */
export async function syncHeadcountsFromRegister(db: PrismaClient, dates: string[], uploadId: number): Promise<HeadcountSyncResult> {
  const res: HeadcountSyncResult = { created: [], refreshed: [], kept: [] }
  const sorted = [...new Set(dates)].sort()
  if (!sorted.length) return res
  const register = await registerBreakdownNow(sorted[0], sorted.at(-1)!, {}, db)
  for (const date of sorted) {
    const numbers = register[date]
    if (!numbers) continue
    const service = await db.service.findUnique({
      where: { date: new Date(`${date}T00:00:00.000Z`) },
      select: { id: true, headcounts: { where: { isCurrent: true }, select: { id: true, fromRegister: true, upload: { select: { kind: true } } } } },
    })
    if (!service) continue
    const values = pick(numbers)
    const total = computeTotal(values)
    const current = service.headcounts[0]
    if (!current) {
      await db.serviceHeadcount.create({ data: { ...values, children: 0, total, serviceId: service.id, uploadId, fromRegister: true } })
      res.created.push(date)
    } else if (followsRegister(current)) {
      await db.serviceHeadcount.update({ where: { id: current.id }, data: { ...values, total, uploadId, fromRegister: true } })
      res.refreshed.push(date)
    } else {
      res.kept.push(date)
    }
  }
  return res
}

/**
 * Keep the weekly headcount in step when one person is marked present/absent by hand.
 * Marking someone can also change whether they count as a first/second timer on their later Sundays,
 * so every Sunday from `dateIso` that the person attended is updated.
 * - No headcount yet → create one from the register (children 0).
 * - Headcount that follows the register → set the register numbers, keep children.
 * Run it inside a transaction so attendance and headcount are saved together or not at all.
 * - Headcount entered by hand or from the Chart sheet → add/remove this person in the right
 *   group (worker/member/first/second timer, male/female) and in the total.
 */
export async function syncHeadcountsForMark(db: Prisma.TransactionClient, memberId: number, dateIso: string, change: () => Promise<void>) {
  const from = new Date(`${dateIso}T00:00:00.000Z`)
  const later = await db.attendance.findMany({
    where: { memberId, service: { date: { gt: from } } },
    select: { service: { select: { date: true } } },
  })
  const dates = [...new Set([dateIso, ...later.map((a) => isoDate(a.service.date))])].sort()
  const last = dates.at(-1)!
  const before = await registerBreakdownNow(dateIso, last, {}, db)
  await change()
  const after = await registerBreakdownNow(dateIso, last, {}, db)

  const services = await db.service.findMany({
    where: { date: { in: dates.map((d) => new Date(`${d}T00:00:00.000Z`)) } },
    select: { id: true, date: true, recordTaken: true, headcounts: { where: { isCurrent: true }, select: { id: true, fromRegister: true, workers: true, members: true, firstTimers: true, secondTimers: true, total: true, male: true, female: true, upload: { select: { kind: true } } } } },
  })
  for (const svc of services) {
    const date = isoDate(svc.date)
    const b = before[date] ?? ZERO
    const a = after[date] ?? ZERO
    const current = svc.headcounts[0]
    if (!current || followsRegister(current)) {
      if (!svc.recordTaken) continue
      const values = pick(a)
      const total = computeTotal(values)
      if (current) await db.serviceHeadcount.update({ where: { id: current.id }, data: { ...values, total, fromRegister: true } })
      else if (a.total > 0) await db.serviceHeadcount.create({ data: { ...values, children: 0, total, serviceId: svc.id, fromRegister: true } })
      continue
    }
    const diff = REGISTER_FIELDS.map((k) => [k, (a[k] as number) - (b[k] as number)] as const)
    const totalDiff = a.total - b.total
    if (totalDiff === 0 && diff.every(([, d]) => d === 0)) continue
    await db.serviceHeadcount.update({
      where: { id: current.id },
      data: {
        ...Object.fromEntries(diff.map(([k, d]) => [k, Math.max(0, current[k] + d)])),
        total: Math.max(0, current.total + totalDiff),
      },
    })
  }
}
