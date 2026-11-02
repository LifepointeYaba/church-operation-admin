import { z } from "zod"
import { prisma } from "./db"
import { normalizePhone } from "./phone"
import { cleanName, nameKey } from "./keys"
import { cleanEmail, cleanGender, flagsFor } from "./import/attendance"
import { audit } from "./audit"
import { refreshDerivedMemberData } from "./import/apply"

export const memberInput = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().default(""),
  phone: z.string().trim().default(""),
  altPhone: z.string().trim().optional().default(""),
  email: z.string().trim().optional().default(""),
  address: z.string().trim().optional().default(""),
  gender: z.string().trim().optional().default(""),
  status: z.string().trim().min(1),
  branch: z.string().trim().optional().default("Main"),
  personResponsible: z.string().trim().optional().default(""),
  notes: z.string().trim().optional().default(""),
})
export type MemberInput = z.input<typeof memberInput>

export function prepare(input: MemberInput) {
  const v = memberInput.parse(input)
  const ph = normalizePhone(v.phone)
  const gender = cleanGender(v.gender)
  const lastName = cleanName(v.lastName)
  return {
    phoneProblem: ph.problem,
    data: {
      firstName: cleanName(v.firstName),
      lastName,
      nameKey: nameKey(v.firstName, v.lastName),
      phone: ph.phone,
      phoneKey: ph.phoneKey,
      altPhone: v.altPhone ? normalizePhone(v.altPhone).phone : null,
      email: cleanEmail(v.email),
      address: v.address || null,
      gender,
      status: v.status,
      branch: v.branch || "Main",
      personResponsible: v.personResponsible || null,
      notes: v.notes || null,
      flags: flagsFor({ lastName, gender, phoneProblem: ph.problem }),
    },
  }
}

/** Possible duplicates for a name + phone (live check while adding). */
export async function findDuplicates(first: string, last: string, phone: string, excludeId?: number) {
  const key = nameKey(first, last)
  const ph = normalizePhone(phone)
  const or = [{ nameKey: key }, ...(ph.phoneKey ? [{ phoneKey: ph.phoneKey }] : [])]
  if (!key && !ph.phoneKey) return { exact: null, similar: [] }
  const rows = await prisma.member.findMany({
    where: { deletedAt: null, OR: or, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true, firstName: true, lastName: true, phone: true, status: true, nameKey: true, phoneKey: true },
    take: 10,
  })
  const exact = rows.find((r) => r.nameKey === key && ph.phoneKey && r.phoneKey === ph.phoneKey) ?? null
  return { exact, similar: rows.filter((r) => r !== exact) }
}

const snapshot = (m: Record<string, unknown>) => {
  const { createdAt, updatedAt, ...rest } = m
  void createdAt
  void updatedAt
  return rest
}

export async function createMember(input: MemberInput, opts: { presentAt?: number } = {}) {
  const { data, phoneProblem } = prepare(input)
  if (phoneProblem) throw new Error(phoneProblem === "missing" ? "Phone number is required for new records" : "Enter a valid 11-digit phone number")
  const dup = await findDuplicates(data.firstName, data.lastName, data.phone ?? "")
  if (dup.exact) throw new Error(`Already registered: ${dup.exact.firstName} ${dup.exact.lastName} (#${dup.exact.id})`)
  const m = await prisma.member.create({ data })
  await prisma.statusHistory.create({ data: { memberId: m.id, old: null, new: m.status, reason: "Added in app" } })
  if (opts.presentAt) {
    await prisma.attendance.create({ data: { memberId: m.id, serviceId: opts.presentAt } })
    await prisma.member.update({ where: { id: m.id }, data: { firstSeenServiceId: opts.presentAt } })
  }
  await audit("create", "member", m.id, null, snapshot(m))
  await refreshDerivedMemberData(prisma)
  return m
}

export class ClashError extends Error {
  constructor(public otherId: number, message: string) {
    super(message)
  }
}

export async function updateMember(id: number, input: MemberInput, reason = "Edited in app") {
  const before = await prisma.member.findUniqueOrThrow({ where: { id } })
  const { data } = prepare(input)
  const clash = await prisma.member.findFirst({
    where: { id: { not: id }, nameKey: data.nameKey, phoneKey: data.phoneKey ?? undefined, deletedAt: null },
  })
  if (clash && data.phoneKey) throw new ClashError(clash.id, `Another record (#${clash.id}) already has this name and phone. Merge them instead.`)
  const keepFlags = before.flags.filter((f) => f === "shared_phone")
  const after = await prisma.member.update({ where: { id }, data: { ...data, flags: [...data.flags, ...keepFlags] } })
  if (before.status !== after.status) {
    await prisma.statusHistory.create({ data: { memberId: id, old: before.status, new: after.status, reason } })
  }
  await audit("update", "member", id, snapshot(before), snapshot(after))
  if (before.phoneKey !== after.phoneKey || before.nameKey !== after.nameKey) await refreshDerivedMemberData(prisma)
  return after
}

export async function setStatus(id: number, status: string, reason: string) {
  const before = await prisma.member.findUniqueOrThrow({ where: { id } })
  if (before.status === status) return
  await prisma.member.update({ where: { id }, data: { status } })
  await prisma.statusHistory.create({ data: { memberId: id, old: before.status, new: status, reason } })
  await audit("update", "member", id, { status: before.status }, { status })
}

export async function setTeams(id: number, teamNames: string[]) {
  const names = [...new Set(teamNames.map(cleanName).filter(Boolean))]
  const before = await prisma.memberTeam.findMany({ where: { memberId: id }, include: { team: true } })
  await prisma.team.createMany({ data: names.map((name) => ({ name })), skipDuplicates: true })
  const teams = await prisma.team.findMany({ where: { name: { in: names } } })
  await prisma.$transaction([
    prisma.memberTeam.deleteMany({ where: { memberId: id } }),
    prisma.memberTeam.createMany({ data: teams.map((t) => ({ memberId: id, teamId: t.id })) }),
  ])
  await audit("update", "member", id, { teams: before.map((b) => b.team.name) }, { teams: names })
}

/** Move everything from `removeId` onto `keepId`, then delete `removeId`. */
export async function mergeMembers(keepId: number, removeId: number) {
  if (keepId === removeId) throw new Error("Pick two different records")
  const [keep, remove] = await Promise.all([
    prisma.member.findUniqueOrThrow({ where: { id: keepId } }),
    prisma.member.findUniqueOrThrow({ where: { id: removeId }, include: { teams: true } }),
  ])
  const fill: Record<string, unknown> = {}
  for (const f of ["email", "address", "gender", "personResponsible", "altPhone", "notes"] as const) {
    if (!keep[f] && remove[f]) fill[f] = remove[f]
  }
  if (!keep.phone && remove.phone) Object.assign(fill, { phone: remove.phone, phoneKey: remove.phoneKey })
  await prisma.$transaction([
    prisma.$executeRaw`INSERT INTO attendance (member_id, service_id, marked_at)
      SELECT ${keepId}, service_id, marked_at FROM attendance WHERE member_id = ${removeId}
      ON CONFLICT DO NOTHING`,
    prisma.$executeRaw`INSERT INTO member_teams (member_id, team_id)
      SELECT ${keepId}, team_id FROM member_teams WHERE member_id = ${removeId} ON CONFLICT DO NOTHING`,
    prisma.followUp.updateMany({ where: { memberId: removeId }, data: { memberId: keepId } }),
    prisma.statusHistory.updateMany({ where: { memberId: removeId }, data: { memberId: keepId } }),
    prisma.statusSuggestion.deleteMany({ where: { memberId: removeId } }),
    prisma.member.update({ where: { id: keepId }, data: fill }),
    prisma.member.delete({ where: { id: removeId } }),
  ])
  await audit("merge", "member", keepId, snapshot(remove as unknown as Record<string, unknown>), { mergedInto: keepId, filled: fill })
  await refreshDerivedMemberData(prisma)
}

/** Restore a member's details to the "before" values of an audit entry. */
export async function revertAudit(auditId: number) {
  const entry = await prisma.auditLog.findUniqueOrThrow({ where: { id: auditId } })
  if (entry.entity !== "member" || entry.action !== "update" || !entry.before || !entry.entityId) {
    throw new Error("Only member edits can be reverted")
  }
  const id = Number(entry.entityId)
  const before = entry.before as Record<string, unknown>
  if (Array.isArray(before.teams)) return setTeams(id, before.teams as string[])
  const current = await prisma.member.findUniqueOrThrow({ where: { id } })
  const fields = ["firstName", "lastName", "phone", "altPhone", "email", "address", "gender", "status", "branch", "personResponsible", "notes"] as const
  const merged = Object.fromEntries(fields.map((f) => [f, (f in before ? before[f] : current[f]) ?? ""]))
  await updateMember(id, merged as MemberInput, `Reverted change #${auditId}`)
}

export async function softDelete(id: number) {
  await prisma.member.update({ where: { id }, data: { deletedAt: new Date() } })
  await audit("delete", "member", id)
}

export async function restore(id: number) {
  await prisma.member.update({ where: { id }, data: { deletedAt: null } })
  await audit("restore", "member", id)
}

/** Permanent erasure on request (NDPA). The audit entry records only the id. */
export async function eraseMember(id: number) {
  await prisma.member.delete({ where: { id } })
  await prisma.$executeRaw`UPDATE audit_log SET before = NULL, after = NULL WHERE entity = 'member' AND entity_id = ${String(id)}`
  await audit("erase", "member", id)
}

export async function purgeExpiredDeletes() {
  const cutoff = new Date(Date.now() - 30 * 86400000)
  const old = await prisma.member.findMany({ where: { deletedAt: { lt: cutoff } }, select: { id: true } })
  for (const m of old) await eraseMember(m.id)
  return old.length
}
