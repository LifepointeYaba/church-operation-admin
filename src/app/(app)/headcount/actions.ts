"use server"

import { requireAdmin } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { audit } from "@/lib/audit"
import { refreshData } from "@/lib/revalidate"
import { fromIso, isoDate } from "@/lib/dates"
import { noteType, validateHeadcount, type HeadcountValues } from "@/lib/import/headcount"
import { applyHeadcounts } from "@/lib/import/apply"
import { REGISTER_FIELDS, followsRegister } from "@/lib/headcount-sync"

async function existingDates(dates: string[]) {
  const rows = await prisma.serviceHeadcount.findMany({
    where: { isCurrent: true, service: { date: { in: dates.filter((d) => fromIso(d)).map((d) => new Date(`${d}T00:00:00Z`)) } } },
    include: { service: true, upload: { select: { kind: true } } },
  })
  return new Map(rows.map((r) => [isoDate(r.service.date), r]))
}

export async function saveHeadcountAction(dateIso: string, values: HeadcountValues, notes: string, replace: boolean) {
  await requireAdmin()
  const d = fromIso(dateIso)
  const v = { ...values, total: values.workers + values.members + values.firstTimers + values.secondTimers }
  const { errors, warnings } = validateHeadcount(d, v)
  if (errors.length) return { ok: false as const, error: errors.join("; ") }
  const existing = (await existingDates([dateIso])).get(dateIso)
  const lines = notes.split("\n").map((l) => l.trim()).filter(Boolean)
  // Only children (or nothing) changed on a Sunday that follows the register: update it in place so
  // later uploads and attendance marks for the same Sunday can still refresh the register numbers.
  if (existing && followsRegister(existing) && REGISTER_FIELDS.every((k) => existing[k] === v[k])) {
    await prisma.serviceHeadcount.update({ where: { id: existing.id }, data: { children: v.children } })
    for (const text of lines) await prisma.serviceNote.create({ data: { serviceId: existing.serviceId, type: noteType(text), text } })
    await audit("headcount_children", "service", dateIso, { children: existing.children }, { children: v.children })
    refreshData()
    return { ok: true as const, warnings, replaced: false }
  }
  if (existing && !replace) return { ok: false as const, exists: true, error: "This Sunday already has a headcount" }
  const res = await applyHeadcounts(
    prisma,
    [{ ...v, date: dateIso, errors: [], warnings }],
    lines.map((text) => ({ date: dateIso, type: noteType(text), text })),
    { replaceDates: [dateIso] },
  )
  await audit(existing ? "headcount_replace" : "headcount_create", "service", dateIso, existing, v)
  refreshData()
  return { ok: true as const, warnings, replaced: res.replaced > 0 }
}

export async function addNoteAction(dateIso: string, text: string) {
  await requireAdmin()
  const d = fromIso(dateIso)
  if (!d || !text.trim()) return { ok: false as const, error: "Enter a note" }
  const svc = await prisma.service.upsert({ where: { date: d }, create: { date: d }, update: {} })
  const n = await prisma.serviceNote.create({ data: { serviceId: svc.id, type: noteType(text), text: text.trim() } })
  await audit("note_create", "service", dateIso, null, n)
  refreshData()
  return { ok: true as const }
}

export async function deleteNoteAction(id: number) {
  await requireAdmin()
  const n = await prisma.serviceNote.delete({ where: { id } })
  await audit("note_delete", "service", n.serviceId, n, null)
  refreshData()
  return { ok: true as const }
}
