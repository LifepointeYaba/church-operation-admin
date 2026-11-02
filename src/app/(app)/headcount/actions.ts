"use server"

import { requireAdmin } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { audit } from "@/lib/audit"
import { refreshData } from "@/lib/revalidate"
import { fromIso, isoDate } from "@/lib/dates"
import { readGrid } from "@/lib/import/csv"
import { noteType, parseHeadcountGrid, validateHeadcount, type HeadcountValues } from "@/lib/import/headcount"
import { applyHeadcounts } from "@/lib/import/apply"
import { storeFile } from "@/lib/blob"

const MAX_BYTES = 5 * 1024 * 1024

async function existingDates(dates: string[]) {
  const rows = await prisma.serviceHeadcount.findMany({
    where: { isCurrent: true, service: { date: { in: dates.filter((d) => fromIso(d)).map((d) => new Date(`${d}T00:00:00Z`)) } } },
    include: { service: true },
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
  if (existing && !replace) return { ok: false as const, exists: true, error: "This Sunday already has a headcount" }
  const lines = notes.split("\n").map((l) => l.trim()).filter(Boolean)
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

async function readUpload(form: FormData) {
  const file = form.get("file")
  if (!(file instanceof File) || file.size === 0) throw new Error("Choose a CSV or Excel file")
  if (file.size > MAX_BYTES) throw new Error("File is larger than 5 MB")
  const buf = Buffer.from(await file.arrayBuffer())
  return { file, buf, parsed: parseHeadcountGrid(readGrid(buf, file.name)) }
}

export async function previewHeadcountUpload(form: FormData) {
  await requireAdmin()
  try {
    const { parsed } = await readUpload(form)
    const existing = await existingDates(parsed.rows.map((r) => r.date))
    return {
      ok: true as const,
      rows: parsed.rows.map((r) => ({ ...r, existing: existing.get(r.date)?.total ?? null })),
      notes: parsed.notes.length,
      skippedBlocks: parsed.skippedBlocks,
    }
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Could not read the file" }
  }
}

export async function commitHeadcountUpload(form: FormData, replaceDates: string[]) {
  await requireAdmin()
  try {
    const { file, buf, parsed } = await readUpload(form)
    const blobUrl = await storeFile("headcount", file.name, buf, file.type)
    const upload = await prisma.upload.create({ data: { kind: "headcount", fileName: file.name, blobUrl, status: "processing" } })
    const res = await applyHeadcounts(prisma, parsed.rows, parsed.notes, { uploadId: upload.id, replaceDates })
    await prisma.upload.update({
      where: { id: upload.id },
      data: {
        rowsOk: res.saved,
        rowsFailed: res.failed,
        status: "completed",
        summary: { ...res, skippedBlocks: parsed.skippedBlocks, errors: parsed.rows.filter((r) => r.errors.length).map((r) => ({ date: r.date, errors: r.errors })) },
      },
    })
    await audit("import", "upload", upload.id, null, res)
    refreshData()
    return { ok: true as const, ...res }
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Upload failed" }
  }
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
