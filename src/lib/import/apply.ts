import type { Prisma, PrismaClient } from "@prisma/client"
import type { AttendanceParseResult } from "./attendance"
import type { HeadcountRow, ParsedNote } from "./headcount"

type Db = PrismaClient

export type ImportSummary = {
  membersAdded: number
  membersUpdated: number
  membersNeedingConfirm: { row: number; name: string }[]
  servicesAdded: number
  attendanceAdded: number
  rejected: { row?: number; header?: string; reason: string }[]
}

const toDate = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

async function ensureServices(db: Db, services: { date: string; recordTaken: boolean }[]) {
  const existing = await db.service.findMany({ where: { date: { in: services.map((s) => toDate(s.date)) } } })
  const have = new Set(existing.map((s) => s.date.toISOString().slice(0, 10)))
  const missing = services.filter((s) => !have.has(s.date))
  if (missing.length) {
    await db.service.createMany({
      data: missing.map((s) => ({ date: toDate(s.date), recordTaken: s.recordTaken })),
      skipDuplicates: true,
    })
  }
  const all = await db.service.findMany({ where: { date: { in: services.map((s) => toDate(s.date)) } } })
  return { added: missing.length, byDate: new Map(all.map((s) => [s.date.toISOString().slice(0, 10), s])) }
}

/**
 * Import parsed attendance-file data. Matching people (name + phone) are updated, never duplicated:
 * empty fields are filled from the file, teams are added, and new present marks are added.
 * People with no phone are matched on name only when exactly one phoneless record has that name;
 * otherwise they are reported for manual confirmation (or created when `createUnmatchedNoPhone`).
 */
export async function applyAttendanceImport(
  db: Db,
  parsed: AttendanceParseResult,
  opts: { createUnmatchedNoPhone?: boolean } = {},
): Promise<ImportSummary> {
  const summary: ImportSummary = {
    membersAdded: 0,
    membersUpdated: 0,
    membersNeedingConfirm: [],
    servicesAdded: 0,
    attendanceAdded: 0,
    rejected: [
      ...parsed.rejectedColumns.map((c) => ({ header: c.header, reason: c.reason })),
      ...parsed.rejectedRows.map((r) => ({ row: r.row, reason: r.reason })),
    ],
  }

  const { added, byDate } = await ensureServices(db, parsed.services)
  summary.servicesAdded = added

  // Teams
  const teamNames = [...new Set(parsed.people.flatMap((p) => p.teams))]
  if (teamNames.length) await db.team.createMany({ data: teamNames.map((name) => ({ name })), skipDuplicates: true })
  const teams = new Map((await db.team.findMany()).map((t) => [t.name.toLowerCase(), t.id]))

  // Existing members
  const existing = await db.member.findMany({
    select: { id: true, nameKey: true, phoneKey: true, email: true, gender: true, personResponsible: true, lastName: true },
  })
  const byKey = new Map(existing.filter((m) => m.phoneKey).map((m) => [`${m.nameKey}|${m.phoneKey}`, m]))
  const noPhoneByName = new Map<string, typeof existing>()
  existing.filter((m) => !m.phoneKey).forEach((m) => noPhoneByName.set(m.nameKey, [...(noPhoneByName.get(m.nameKey) ?? []), m]))

  const idForRow = new Map<number, number>()
  const toCreate: typeof parsed.people = []

  for (const p of parsed.people) {
    let match = p.phoneKey ? byKey.get(`${p.nameKey}|${p.phoneKey}`) : undefined
    if (!p.phoneKey) {
      const cands = noPhoneByName.get(p.nameKey) ?? []
      if (cands.length === 1) match = cands[0]
      else if (cands.length > 1 && !opts.createUnmatchedNoPhone) {
        summary.membersNeedingConfirm.push({ row: p.row, name: `${p.firstName} ${p.lastName}`.trim() })
        continue
      }
    }
    if (match) {
      idForRow.set(p.row, match.id)
      const data: Prisma.MemberUpdateInput = {}
      if (!match.email && p.email) data.email = p.email
      if (!match.gender && p.gender) data.gender = p.gender
      if (!match.personResponsible && p.personResponsible) data.personResponsible = p.personResponsible
      if (Object.keys(data).length) {
        await db.member.update({ where: { id: match.id }, data })
        summary.membersUpdated++
      }
    } else {
      toCreate.push(p)
    }
  }

  // Create new members in bulk, then look their ids up by key.
  for (let i = 0; i < toCreate.length; i += 500) {
    const chunk = toCreate.slice(i, i + 500)
    await db.member.createMany({
      data: chunk.map((p) => ({
        firstName: p.firstName,
        lastName: p.lastName,
        nameKey: p.nameKey,
        phone: p.phone,
        phoneKey: p.phoneKey,
        email: p.email,
        gender: p.gender,
        status: p.status,
        personResponsible: p.personResponsible,
        flags: p.flags,
      })),
    })
  }
  summary.membersAdded = toCreate.length
  if (toCreate.length) {
    const created = await db.member.findMany({
      where: { nameKey: { in: toCreate.map((p) => p.nameKey) } },
      select: { id: true, nameKey: true, phoneKey: true },
      orderBy: { id: "asc" },
    })
    const used = new Set(idForRow.values())
    for (const p of toCreate) {
      const m = created.find((c) => !used.has(c.id) && c.nameKey === p.nameKey && c.phoneKey === p.phoneKey)
      if (m) {
        idForRow.set(p.row, m.id)
        used.add(m.id)
      }
    }
    await db.statusHistory.createMany({
      data: toCreate
        .filter((p) => idForRow.has(p.row))
        .map((p) => ({ memberId: idForRow.get(p.row)!, old: null, new: p.status, reason: "Imported from attendance file" })),
    })
  }

  // Team links and attendance
  const links: { memberId: number; teamId: number }[] = []
  const marks: { memberId: number; serviceId: number }[] = []
  for (const p of parsed.people) {
    const memberId = idForRow.get(p.row)
    if (!memberId) continue
    p.teams.forEach((t) => {
      const teamId = teams.get(t.toLowerCase())
      if (teamId) links.push({ memberId, teamId })
    })
    p.present.forEach((iso) => {
      const s = byDate.get(iso)
      if (s) marks.push({ memberId, serviceId: s.id })
    })
  }
  if (links.length) await db.memberTeam.createMany({ data: links, skipDuplicates: true })
  for (let i = 0; i < marks.length; i += 5000) {
    const res = await db.attendance.createMany({ data: marks.slice(i, i + 5000), skipDuplicates: true })
    summary.attendanceAdded += res.count
  }

  await refreshDerivedMemberData(db)
  return summary
}

/** Recompute first-seen Sunday and the shared-phone flag for all members. */
export async function refreshDerivedMemberData(db: Db) {
  await db.$executeRaw`
    UPDATE members m SET first_seen_service_id = sub.sid
    FROM (
      SELECT DISTINCT ON (a.member_id) a.member_id, a.service_id AS sid
      FROM attendance a JOIN services s ON s.id = a.service_id
      ORDER BY a.member_id, s.date
    ) sub
    WHERE m.id = sub.member_id AND m.first_seen_service_id IS DISTINCT FROM sub.sid`
  await db.$executeRaw`
    UPDATE members SET flags = array_remove(flags, 'shared_phone')
    WHERE 'shared_phone' = ANY(flags)`
  await db.$executeRaw`
    UPDATE members SET flags = array_append(flags, 'shared_phone')
    WHERE deleted_at IS NULL AND phone_key IN (
      SELECT phone_key FROM members WHERE phone_key IS NOT NULL AND deleted_at IS NULL
      GROUP BY phone_key HAVING COUNT(DISTINCT name_key) > 1
    )`
}

export type HeadcountApplyResult = { saved: number; replaced: number; skippedExisting: string[]; failed: number; notesAdded: number }

/** Save headcount rows. Rows with errors are skipped. Existing Sundays are replaced (old version kept) only if listed in `replaceDates`. */
export async function applyHeadcounts(
  db: Db,
  rows: HeadcountRow[],
  notes: ParsedNote[],
  opts: { uploadId?: number; replaceDates?: string[] | "all" } = {},
): Promise<HeadcountApplyResult> {
  const res: HeadcountApplyResult = { saved: 0, replaced: 0, skippedExisting: [], failed: 0, notesAdded: 0 }
  const valid = rows.filter((r) => !r.errors.length)
  res.failed = rows.length - valid.length
  if (!valid.length) return res
  const { byDate } = await ensureServices(db, valid.map((r) => ({ date: r.date, recordTaken: true })))
  const current = await db.serviceHeadcount.findMany({
    where: { isCurrent: true, serviceId: { in: valid.map((r) => byDate.get(r.date)!.id) } },
  })
  const currentBySvc = new Map(current.map((c) => [c.serviceId, c]))
  const savedDates = new Set<string>()
  for (const r of valid) {
    const svc = byDate.get(r.date)!
    const cur = currentBySvc.get(svc.id)
    const values = {
      workers: r.workers, members: r.members, firstTimers: r.firstTimers, secondTimers: r.secondTimers,
      male: r.male, female: r.female, children: r.children, total: r.total,
    }
    if (cur) {
      const same = Object.entries(values).every(([k, v]) => cur[k as keyof typeof values] === v)
      const allowed = opts.replaceDates === "all" || opts.replaceDates?.includes(r.date)
      if (same || !allowed) {
        if (!same) res.skippedExisting.push(r.date)
        continue
      }
      await db.$transaction([
        db.serviceHeadcount.update({ where: { id: cur.id }, data: { isCurrent: false } }),
        db.serviceHeadcount.create({ data: { ...values, serviceId: svc.id, uploadId: opts.uploadId, version: cur.version + 1 } }),
      ])
      res.replaced++
    } else {
      await db.serviceHeadcount.create({ data: { ...values, serviceId: svc.id, uploadId: opts.uploadId } })
    }
    res.saved++
    savedDates.add(r.date)
  }
  // Notes: add only ones not already stored for that Sunday.
  const forSaved = notes.filter((n) => byDate.has(n.date))
  if (forSaved.length) {
    const existing = await db.serviceNote.findMany({ where: { serviceId: { in: forSaved.map((n) => byDate.get(n.date)!.id) } } })
    const have = new Set(existing.map((e) => `${e.serviceId}|${e.text}`))
    const fresh = forSaved
      .map((n) => ({ serviceId: byDate.get(n.date)!.id, type: n.type, text: n.text }))
      .filter((n) => !have.has(`${n.serviceId}|${n.text}`))
    if (fresh.length) res.notesAdded = (await db.serviceNote.createMany({ data: fresh })).count
  }
  return res
}
