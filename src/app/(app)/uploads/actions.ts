"use server"

import { requireAdmin } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { audit } from "@/lib/audit"
import { refreshData } from "@/lib/revalidate"
import { readGrid } from "@/lib/import/csv"
import { parseAttendanceGrid } from "@/lib/import/attendance"
import { applyAttendanceImport } from "@/lib/import/apply"
import { storeFile } from "@/lib/blob"

async function read(form: FormData) {
  const file = form.get("file")
  if (!(file instanceof File) || file.size === 0) throw new Error("Choose the attendance CSV or Excel file")
  if (file.size > 10 * 1024 * 1024) throw new Error("File is larger than 10 MB")
  const buf = Buffer.from(await file.arrayBuffer())
  return { file, buf, parsed: parseAttendanceGrid(readGrid(buf, file.name)) }
}

export async function previewAttendanceImport(form: FormData) {
  await requireAdmin()
  try {
    const { parsed } = await read(form)
    const existing = await prisma.member.findMany({ select: { nameKey: true, phoneKey: true } })
    const keys = new Set(existing.map((m) => `${m.nameKey}|${m.phoneKey ?? ""}`))
    const services = await prisma.service.findMany({ select: { date: true } })
    const haveDates = new Set(services.map((s) => s.date.toISOString().slice(0, 10)))
    const matched = parsed.people.filter((p) => keys.has(`${p.nameKey}|${p.phoneKey ?? ""}`)).length
    return {
      ok: true as const,
      people: parsed.people.length,
      matched,
      added: parsed.people.length - matched,
      flagged: parsed.people.filter((p) => p.flags.length).length,
      sundays: parsed.services.length,
      newSundays: parsed.services.filter((s) => !haveDates.has(s.date)).length,
      marks: parsed.people.reduce((a, p) => a + p.present.length, 0),
      rejectedColumns: parsed.rejectedColumns,
      rejectedRows: parsed.rejectedRows,
    }
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Could not read the file" }
  }
}

export async function commitAttendanceImport(form: FormData, createUnmatchedNoPhone: boolean) {
  await requireAdmin()
  try {
    const { file, buf, parsed } = await read(form)
    const blobUrl = await storeFile("attendance", file.name, buf, file.type)
    const upload = await prisma.upload.create({ data: { kind: "attendance", fileName: file.name, blobUrl, status: "processing" } })
    const sum = await applyAttendanceImport(prisma, parsed, { createUnmatchedNoPhone })
    await prisma.upload.update({
      where: { id: upload.id },
      data: {
        rowsOk: parsed.people.length - sum.membersNeedingConfirm.length,
        rowsFailed: sum.rejected.length + sum.membersNeedingConfirm.length,
        status: sum.membersNeedingConfirm.length ? "needs review" : "completed",
        summary: sum,
      },
    })
    await audit("import", "upload", upload.id, null, sum)
    refreshData()
    return { ok: true as const, ...sum }
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Import failed" }
  }
}
