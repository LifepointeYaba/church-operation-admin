"use server"

import { requireAdmin } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { audit } from "@/lib/audit"
import { refreshData } from "@/lib/revalidate"
import { readGrid } from "@/lib/import/csv"
import { parseAttendanceGrid } from "@/lib/import/attendance"
import { applyAttendanceImport, refreshDerivedMemberData } from "@/lib/import/apply"
import { storeFile } from "@/lib/blob"
import { getSettings } from "@/lib/settings"
import type { Prisma } from "@prisma/client"
import type { ParsedPerson } from "@/lib/import/attendance"
import { matchAttendancePerson } from "@/lib/import/matching"
import { nameKey as makeNameKey } from "@/lib/keys"
import { normalizePhone } from "@/lib/phone"
import { createHash } from "node:crypto"

async function read(form: FormData) {
  const file = form.get("file")
  if (!(file instanceof File) || file.size === 0) throw new Error("Choose the attendance CSV or Excel file")
  if (file.size > 10 * 1024 * 1024) throw new Error("File is larger than 10 MB")
  const buf = Buffer.from(await file.arrayBuffer())
  const sundayDate = form.get("sundayDate")
  return {
    file,
    buf,
    parsed: parseAttendanceGrid(readGrid(buf, file.name), undefined, typeof sundayDate === "string" ? sundayDate : undefined),
  }
}

type ParsedAttendance = Awaited<ReturnType<typeof read>>["parsed"]

/**
 * Detects a re-upload: either the exact same file was imported before, or every Sunday in
 * the file already has attendance recorded. Multi-Sunday sheets that add at least one new
 * Sunday are allowed through (re-importing them only merges), but report the overlap.
 */
async function findDuplicateUpload(fileHash: string, parsed: ParsedAttendance) {
  const dates = [...new Set(parsed.services.map((s) => s.date))].sort()
  const [sameFile, recorded] = await Promise.all([
    prisma.upload.findFirst({
      where: { kind: "attendance", summary: { path: ["fileHash"], equals: fileHash } },
      orderBy: { uploadedAt: "desc" },
      select: { id: true, fileName: true, uploadedAt: true },
    }),
    dates.length
      ? prisma.service.findMany({
        where: { date: { in: dates.map((d) => new Date(`${d}T00:00:00.000Z`)) }, attendance: { some: {} } },
        select: { date: true },
      })
      : Promise.resolve([]),
  ])
  const alreadyRecorded = recorded.map((s) => s.date.toISOString().slice(0, 10)).sort()
  const allWeeksRecorded = dates.length > 0 && alreadyRecorded.length === dates.length
  return {
    blocked: Boolean(sameFile) || allWeeksRecorded,
    sameFile: sameFile ? { id: sameFile.id, fileName: sameFile.fileName, uploadedAt: sameFile.uploadedAt.toISOString() } : null,
    alreadyRecorded,
    allWeeksRecorded,
  }
}

function hashFile(buf: Buffer) {
  return createHash("sha256").update(buf).digest("hex")
}

export async function previewAttendanceImport(form: FormData) {
  await requireAdmin()
  try {
    const { buf, parsed } = await read(form)
    const duplicate = await findDuplicateUpload(hashFile(buf), parsed)
    const existing = await prisma.member.findMany({
      where: { deletedAt: null },
      select: { id: true, nameKey: true, phoneKey: true, email: true },
    })
    const services = await prisma.service.findMany({ select: { date: true } })
    const haveDates = new Set(services.map((s) => s.date.toISOString().slice(0, 10)))
    const matches = parsed.people.map((person) => ({ person, result: matchAttendancePerson(person, existing) }))
    const matched = matches.filter(({ result }) => result.kind === "matched").length
    const unmatchedExisting = matches.filter(({ person, result }) => person.firstTime === false && result.kind === "unmatched")
    const needsConfirm = matches.filter(({ result }) => result.kind === "ambiguous")
    return {
      ok: true as const,
      people: parsed.people.length,
      matched,
      added: matches.filter(({ person, result }) => person.firstTime !== false && result.kind === "unmatched").length,
      pendingApproval: unmatchedExisting.map(({ person }) => ({ row: person.row, name: `${person.firstName} ${person.lastName}`.trim() })),
      needsConfirm: needsConfirm.map(({ person }) => ({ row: person.row, name: `${person.firstName} ${person.lastName}`.trim() })),
      flagged: parsed.people.filter((p) => p.flags.length).length,
      sundays: parsed.services.length,
      newSundays: parsed.services.filter((s) => !haveDates.has(s.date)).length,
      marks: parsed.people.reduce((a, p) => a + p.present.length, 0),
      rejectedColumns: parsed.rejectedColumns,
      rejectedRows: parsed.rejectedRows,
      duplicate,
    }
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Could not read the file" }
  }
}

export async function commitAttendanceImport(form: FormData, createUnmatchedNoPhone: boolean, allowDuplicate = false) {
  await requireAdmin()
  let uploadId: number | null = null
  try {
    const { file, buf, parsed } = await read(form)
    const fileHash = hashFile(buf)
    const duplicate = await findDuplicateUpload(fileHash, parsed)
    if (duplicate.blocked && !allowDuplicate) {
      return {
        ok: false as const,
        error: duplicate.sameFile
          ? `This exact file was already imported as “${duplicate.sameFile.fileName}”.`
          : `Attendance for ${duplicate.alreadyRecorded.join(", ")} has already been uploaded.`,
        duplicate,
      }
    }
    const serviceDates = [...new Set(parsed.services.map((s) => s.date))].sort()
    const blobUrl = await storeFile("attendance", file.name, buf, file.type)
    const upload = await prisma.upload.create({ data: { kind: "attendance", fileName: file.name, blobUrl, status: "processing" } })
    uploadId = upload.id
    const sum = await applyAttendanceImport(prisma, parsed, { createUnmatchedNoPhone })
    await prisma.upload.update({
      where: { id: upload.id },
      data: {
        rowsOk: parsed.people.length - sum.membersNeedingConfirm.length - sum.membersPendingApproval.length,
        rowsFailed: sum.rejected.length + sum.membersNeedingConfirm.length,
        status: sum.membersPendingApproval.length || sum.membersNeedingConfirm.length ? "needs review" : "completed",
        summary: { ...sum, fileHash, serviceDates, reimport: duplicate.blocked },
      },
    })
    await audit("import", "upload", upload.id, null, { ...sum, reimport: duplicate.blocked })
    refreshData()
    return { ok: true as const, ...sum }
  } catch (e) {
    const error = e instanceof Error ? e.message : "Import failed"
    if (uploadId !== null) {
      await prisma.upload.update({ where: { id: uploadId }, data: { status: "failed", summary: { error } } }).catch(() => {})
      refreshData()
    }
    return { ok: false as const, error }
  }
}

function jsonObject(value: Prisma.JsonValue | null): Prisma.JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Prisma.JsonObject : null
}

function pendingPerson(value: Prisma.JsonValue | undefined, row: number): ParsedPerson | null {
  const entry = jsonObject(value ?? null)
  const person = jsonObject(entry?.person ?? null)
  if (!person || person.row !== row) return null
  const stringValue = (key: string) => person[key]
  const nullableString = (key: string) => {
    const v = stringValue(key)
    return typeof v === "string" || v === null ? v : undefined
  }
  const arrayOfStrings = (key: string) => {
    const v = stringValue(key)
    return Array.isArray(v) && v.every((item) => typeof item === "string") ? v as string[] : undefined
  }
  const firstName = stringValue("firstName")
  const lastName = stringValue("lastName")
  const nameKey = stringValue("nameKey")
  const phone = nullableString("phone")
  const phoneKey = nullableString("phoneKey")
  const email = nullableString("email")
  const personResponsible = nullableString("personResponsible")
  const gender = nullableString("gender")
  const teams = arrayOfStrings("teams")
  const flags = arrayOfStrings("flags")
  const present = arrayOfStrings("present")
  const status = stringValue("status")
  if (
    typeof firstName !== "string" || typeof lastName !== "string" || typeof nameKey !== "string" ||
    phone === undefined || phoneKey === undefined || email === undefined || personResponsible === undefined ||
    gender === undefined || !teams || !flags || !present || typeof status !== "string"
  ) return null
  return {
    row,
    firstName,
    lastName,
    nameKey,
    phone,
    phoneKey,
    email,
    teams,
    status,
    personResponsible,
    gender,
    flags,
    firstTime: false,
    present,
  }
}

export async function searchPendingAttendanceMembers(uploadId: number, row: number, query: string) {
  await requireAdmin()
  try {
    if (!Number.isSafeInteger(uploadId) || uploadId < 1 || !Number.isSafeInteger(row) || row < 2) {
      throw new Error("Invalid upload or row")
    }
    const upload = await prisma.upload.findUnique({ where: { id: uploadId }, select: { kind: true, summary: true } })
    if (!upload || upload.kind !== "attendance") throw new Error("Attendance upload not found")
    const summary = jsonObject(upload.summary)
    const pending = summary?.membersPendingApproval
    const candidate = Array.isArray(pending)
      ? pendingPerson(pending.find((item) => jsonObject(item)?.row === row), row)
      : null
    if (!candidate) throw new Error("Pending member could not be found; refresh and try again")

    const term = query.trim()
    if (term.length < 2) throw new Error("Enter at least 2 characters to search")
    const normalizedPhone = normalizePhone(term).phoneKey
    const digits = term.replace(/\D/g, "")
    const phoneSearch = digits.startsWith("0")
      ? `+234${digits.slice(1)}`
      : digits.startsWith("234")
        ? `+${digits}`
        : /^[789]/.test(digits)
          ? `+234${digits}`
          : null
    const terms = term.split(/\s+/).filter(Boolean)
    const where: Prisma.MemberWhereInput = {
      deletedAt: null,
      OR: [
        { phone: { contains: term } },
        ...(phoneSearch ? [{ phoneKey: { contains: phoneSearch } }] : []),
        ...(normalizedPhone ? [{ phoneKey: normalizedPhone }] : []),
        { email: { contains: term, mode: "insensitive" } },
        {
          AND: terms.map((word) => ({
            OR: [
              { firstName: { contains: word, mode: "insensitive" } },
              { lastName: { contains: word, mode: "insensitive" } },
            ],
          })),
        },
      ],
    }
    const members = await prisma.member.findMany({
      where,
      select: { id: true, firstName: true, lastName: true, phone: true, altPhone: true, email: true, gender: true, status: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      take: 10,
    })
    return { ok: true as const, members }
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Could not search members" }
  }
}

export async function resolvePendingAttendanceImport(
  uploadId: number,
  row: number,
  decision: "approve" | "reject",
  status = "Member",
  selectedMemberId?: number,
) {
  await requireAdmin()
  try {
    if (!Number.isSafeInteger(uploadId) || uploadId < 1 || !Number.isSafeInteger(row) || row < 2) {
      throw new Error("Invalid upload or row")
    }
    if (decision !== "approve" && decision !== "reject") throw new Error("Invalid review decision")
    if (selectedMemberId !== undefined && (!Number.isSafeInteger(selectedMemberId) || selectedMemberId < 1)) {
      throw new Error("Invalid selected member")
    }
    const upload = await prisma.upload.findUnique({ where: { id: uploadId } })
    if (!upload || upload.kind !== "attendance") throw new Error("Attendance upload not found")
    const summary = jsonObject(upload.summary)
    const pending = summary?.membersPendingApproval
    if (!summary || !Array.isArray(pending)) throw new Error("This upload has no pending member reviews")
    const candidate = pendingPerson(pending.find((item) => {
      const entry = jsonObject(item)
      return entry?.row === row
    }), row)
    if (!candidate) throw new Error("Pending member could not be found; refresh and try again")

    let approvedMemberCreated = false
    let approvedMemberUpdated = false
    let approvedMarksAdded = 0
    if (decision === "approve") {
      const settings = await getSettings()
      if (selectedMemberId === undefined && !settings.statuses.includes(status)) throw new Error("Choose a valid member status")
      const updatedCandidate = { ...candidate, status }
      const { member, created, updated, marksAdded } = await prisma.$transaction(async (tx) => {
        let existing: { id: number; firstName: string; lastName: string; nameKey: string; phone: string | null; phoneKey: string | null; altPhone: string | null; email: string | null; gender: string | null; personResponsible: string | null } | null = null
        if (selectedMemberId !== undefined) {
          existing = await tx.member.findFirst({
            where: { id: selectedMemberId, deletedAt: null },
            select: { id: true, firstName: true, lastName: true, nameKey: true, phone: true, phoneKey: true, altPhone: true, email: true, gender: true, personResponsible: true },
          })
          if (!existing) throw new Error("Selected member is no longer available")
        } else {
          const registered = await tx.member.findMany({
            where: { deletedAt: null },
            select: { id: true, nameKey: true, phoneKey: true, email: true },
          })
          const match = matchAttendancePerson(updatedCandidate, registered)
          if (match.kind === "ambiguous") throw new Error("Contact details now match multiple registered people; please resolve the match before approving")
          if (match.kind === "matched") {
            existing = await tx.member.findUnique({
              where: { id: match.member.id },
              select: { id: true, firstName: true, lastName: true, nameKey: true, phone: true, phoneKey: true, altPhone: true, email: true, gender: true, personResponsible: true },
            })
          }
        }
        const saved = existing ?? await tx.member.create({
          data: {
            firstName: updatedCandidate.firstName,
            lastName: updatedCandidate.lastName,
            nameKey: updatedCandidate.nameKey,
            phone: updatedCandidate.phone,
            phoneKey: updatedCandidate.phoneKey,
            email: updatedCandidate.email,
            gender: updatedCandidate.gender,
            status: updatedCandidate.status,
            personResponsible: updatedCandidate.personResponsible,
            flags: updatedCandidate.flags,
          },
          select: { id: true },
        })
        let updated = false
        if (existing) {
          const data: Prisma.MemberUpdateInput = {}
          if (!existing.email && updatedCandidate.email) data.email = updatedCandidate.email
          if (!existing.gender && updatedCandidate.gender) data.gender = updatedCandidate.gender
          if (!existing.personResponsible && updatedCandidate.personResponsible) data.personResponsible = updatedCandidate.personResponsible
          if (!existing.phone && updatedCandidate.phone) {
            data.phone = updatedCandidate.phone
            data.phoneKey = updatedCandidate.phoneKey
          } else if (existing.phone && updatedCandidate.phone && !existing.altPhone && existing.phoneKey !== updatedCandidate.phoneKey) {
            data.altPhone = updatedCandidate.phone
          }
          if (!existing.lastName && updatedCandidate.lastName) {
            data.lastName = updatedCandidate.lastName
            data.nameKey = makeNameKey(existing.firstName, updatedCandidate.lastName)
          }
          if (Object.keys(data).length) {
            await tx.member.update({ where: { id: existing.id }, data })
            updated = true
          }
        } else {
          await tx.statusHistory.create({
            data: { memberId: saved.id, old: null, new: updatedCandidate.status, reason: "Approved from weekly attendance import" },
          })
        }
        let marksAdded = 0
        for (const iso of updatedCandidate.present) {
          const service = await tx.service.findUnique({ where: { date: new Date(`${iso}T00:00:00.000Z`) }, select: { id: true } })
          if (!service) throw new Error(`The attendance service for ${iso} no longer exists`)
          const result = await tx.attendance.createMany({
            data: [{ memberId: saved.id, serviceId: service.id }],
            skipDuplicates: true,
          })
          marksAdded += result.count
        }
        return { member: saved, created: !existing, updated, marksAdded }
      })
      approvedMemberCreated = created
      approvedMemberUpdated = updated
      approvedMarksAdded = marksAdded
      await refreshDerivedMemberData(prisma)
      await audit("import_approve", "member", member.id, null, { uploadId, row })
    } else {
      await audit("import_reject", "upload", uploadId, null, { row, name: `${candidate.firstName} ${candidate.lastName}`.trim() })
    }

    const remaining = pending.filter((item) => jsonObject(item)?.row !== row)
    const nextSummary: Prisma.JsonObject = {
      ...summary,
      membersPendingApproval: remaining,
      ...(decision === "reject"
        ? { rejected: [...(Array.isArray(summary.rejected) ? summary.rejected : []), { row, reason: "Rejected during review" }] }
        : {
          membersAdded: Number(summary.membersAdded ?? 0) + (approvedMemberCreated ? 1 : 0),
          membersUpdated: Number(summary.membersUpdated ?? 0) + (approvedMemberUpdated ? 1 : 0),
          attendanceAdded: Number(summary.attendanceAdded ?? 0) + approvedMarksAdded,
          }),
    }
    await prisma.upload.update({
      where: { id: uploadId },
      data: {
        summary: nextSummary,
        rowsOk: upload.rowsOk + (decision === "approve" ? 1 : 0),
        rowsFailed: upload.rowsFailed + (decision === "reject" ? 1 : 0),
        status: remaining.length || (Array.isArray(summary.membersNeedingConfirm) && summary.membersNeedingConfirm.length > 0)
          ? "needs review"
          : "completed",
      },
    })
    refreshData()
    return { ok: true as const }
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Could not resolve member review" }
  }
}
