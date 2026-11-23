"use server"

import { can, requireUser } from "@/lib/auth"
import type { Permission } from "@/lib/permissions"
import { prisma } from "@/lib/db"
import { audit } from "@/lib/audit"
import { refreshData } from "@/lib/revalidate"
import {
  ClashError, createMember, eraseMember, findDuplicates, mergeMembers, restore, revertAudit, setStatus, setTeams,
  softDelete, updateMember, type MemberInput, applyMemberUpdates, membersForBulkUpdate,
} from "@/lib/members"
import { readGrid } from "@/lib/import/csv"
import { parseMemberUpdates, planMemberUpdates } from "@/lib/import/member-updates"
import { getSettings } from "@/lib/settings"

export type Result<T = unknown> = { ok: true; data?: T } | { ok: false; error: string; clashId?: number }

const FORBIDDEN = { ok: false as const, error: "Your role doesn’t allow this. Ask an admin if you need access." }

/** Runs `fn` when the user's role has any of `perms`. */
async function run<T>(perms: Permission | Permission[], fn: () => Promise<T>): Promise<Result<T>> {
  const user = await requireUser()
  if (![perms].flat().some((p) => can(user, p))) return FORBIDDEN
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
  const user = await requireUser()
  if (!can(user, "members.edit") && !can(user, "attendance.mark")) return { exact: null, similar: [] }
  return findDuplicates(first, last, phone, excludeId)
}

// Ushers add first timers while marking attendance (presentAt set), so attendance.mark may create too.
export const createMemberAction = async (input: MemberInput, presentAt?: number) =>
  run(presentAt ? ["members.edit", "attendance.mark"] : "members.edit", async () => (await createMember(input, { presentAt })).id)

export const updateMemberAction = async (id: number, input: MemberInput) => run("members.edit", async () => (await updateMember(id, input)).id)
export const setTeamsAction = async (id: number, teams: string[]) => run("members.edit", () => setTeams(id, teams))
export const mergeAction = async (keepId: number, removeId: number) => run("members.delete", () => mergeMembers(keepId, removeId))
export const revertAction = async (auditId: number) => run("members.delete", () => revertAudit(auditId))
export const deleteAction = async (id: number) => run("members.delete", () => softDelete(id))
export const restoreAction = async (id: number) => run("members.delete", () => restore(id))
export const eraseAction = async (id: number) => run("members.delete", () => eraseMember(id))

export async function bulkUpdateAction(ids: number[], change: { status?: string; addTeam?: string; personResponsible?: string }) {
  return run("members.edit", async () => {
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
  return run("followUps.log", async () => {
    const row = await prisma.followUp.create({
      data: { memberId, method: f.method, outcome: f.outcome, note: f.note || null, date: f.date ? new Date(f.date) : new Date() },
    })
    await audit("follow_up", "member", memberId, null, row)
    return row.id
  })
}

export async function searchMembersAction(q: string, limit = 20) {
  const user = await requireUser()
  if (!can(user, "members.view")) return []
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

/** Read an uploaded file and work out what it would change. Nothing is saved. */
async function planFromFile(form: FormData) {
  const file = form.get("file")
  if (!(file instanceof File) || file.size === 0) throw new Error("Choose a CSV or Excel file")
  if (file.size > 10 * 1024 * 1024) throw new Error("File is larger than 10 MB")
  const parsed = parseMemberUpdates(readGrid(Buffer.from(await file.arrayBuffer()), file.name))
  const [members, settings] = await Promise.all([membersForBulkUpdate(), getSettings()])
  return { file, plan: planMemberUpdates(parsed, members, settings.statuses) }
}

export async function previewMemberUpdatesAction(form: FormData) {
  const user = await requireUser()
  if (!can(user, "members.edit")) return FORBIDDEN
  try {
    const { plan } = await planFromFile(form)
    return {
      ok: true as const,
      updates: plan.updates.map(({ row, memberId, name, changes }) => ({ row, memberId, name, changes })),
      unchanged: plan.unchanged, errors: plan.errors, columns: plan.columns, ignoredColumns: plan.ignoredColumns,
    }
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Couldn’t read the file" }
  }
}

/** Re-reads the file (so what's saved matches the data right now) and saves the rows that change something. */
export async function applyMemberUpdatesAction(form: FormData) {
  const user = await requireUser()
  if (!can(user, "members.edit")) return FORBIDDEN
  try {
    const { file, plan } = await planFromFile(form)
    const actor = { id: user.id, email: user.email ?? null }
    await applyMemberUpdates(plan.updates, actor)
    await audit("bulk_update", "members", null, null,
      { file: file.name, updated: plan.updates.length, unchanged: plan.unchanged, skipped: plan.errors.length }, undefined, actor)
    refreshData()
    return { ok: true as const, updated: plan.updates.length, unchanged: plan.unchanged, skipped: plan.errors.length }
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Something went wrong" }
  }
}
