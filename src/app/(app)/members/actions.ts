"use server"

import { requireAdmin } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { audit } from "@/lib/audit"
import { refreshData } from "@/lib/revalidate"
import {
  ClashError, createMember, eraseMember, findDuplicates, mergeMembers, restore, revertAudit, setStatus, setTeams,
  softDelete, updateMember, type MemberInput,
} from "@/lib/members"

export type Result<T = unknown> = { ok: true; data?: T } | { ok: false; error: string; clashId?: number }

async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  await requireAdmin()
  try {
    const data = await fn()
    refreshData()
    return { ok: true, data }
  } catch (e) {
    if (e instanceof ClashError) return { ok: false, error: e.message, clashId: e.otherId }
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" }
  }
}

export async function checkDuplicatesAction(first: string, last: string, phone: string, excludeId?: number) {
  await requireAdmin()
  return findDuplicates(first, last, phone, excludeId)
}

export const createMemberAction = async (input: MemberInput, presentAt?: number) =>
  run(async () => (await createMember(input, { presentAt })).id)

export const updateMemberAction = async (id: number, input: MemberInput) => run(async () => (await updateMember(id, input)).id)
export const setTeamsAction = async (id: number, teams: string[]) => run(() => setTeams(id, teams))
export const mergeAction = async (keepId: number, removeId: number) => run(() => mergeMembers(keepId, removeId))
export const revertAction = async (auditId: number) => run(() => revertAudit(auditId))
export const deleteAction = async (id: number) => run(() => softDelete(id))
export const restoreAction = async (id: number) => run(() => restore(id))
export const eraseAction = async (id: number) => run(() => eraseMember(id))

export async function bulkUpdateAction(ids: number[], change: { status?: string; addTeam?: string; personResponsible?: string }) {
  return run(async () => {
    for (const id of ids) {
      if (change.status) await setStatus(id, change.status, "Bulk edit")
      if (change.addTeam) {
        const cur = await prisma.memberTeam.findMany({ where: { memberId: id }, include: { team: true } })
        await setTeams(id, [...cur.map((c) => c.team.name), change.addTeam])
      }
      if (change.personResponsible !== undefined) {
        const before = await prisma.member.findUniqueOrThrow({ where: { id }, select: { personResponsible: true } })
        await prisma.member.update({ where: { id }, data: { personResponsible: change.personResponsible || null } })
        await audit("update", "member", id, before, { personResponsible: change.personResponsible || null })
      }
    }
    return ids.length
  })
}

export async function addFollowUpAction(memberId: number, f: { method: string; outcome: string; note?: string; date?: string }) {
  return run(async () => {
    const row = await prisma.followUp.create({
      data: { memberId, method: f.method, outcome: f.outcome, note: f.note || null, date: f.date ? new Date(f.date) : new Date() },
    })
    await audit("follow_up", "member", memberId, null, row)
    return row.id
  })
}

export async function searchMembersAction(q: string, limit = 20) {
  await requireAdmin()
  const needle = q.trim()
  if (needle.length < 2) return []
  const digits = needle.replace(/\D/g, "").replace(/^0/, "")
  return prisma.member.findMany({
    where: {
      deletedAt: null,
      OR: [
        { nameKey: { contains: needle.toLowerCase().replace(/\s+/g, " ") } },
        ...(digits.length >= 3 ? [{ phoneKey: { contains: digits } }] : []),
        ...(/^\d+$/.test(needle) && needle.length < 6 ? [{ id: Number(needle) }] : []),
      ],
    },
    select: { id: true, firstName: true, lastName: true, phone: true, status: true },
    orderBy: [{ firstName: "asc" }],
    take: limit,
  })
}
