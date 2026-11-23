import type { Member } from "@prisma/client"
import { normalizePhone } from "../phone"
import { cleanName, nameKey } from "../keys"
import { cleanEmail, cleanGender, flagsFor, splitTeams } from "./attendance"

/**
 * Bulk member updates from a spreadsheet (usually the Members "Export CSV", edited and uploaded back).
 * Rows are matched by the ID column, or by phone when there is no ID. A blank cell leaves that field as it is;
 * only fields whose value really changes are saved.
 */

export const UPDATE_FIELDS = {
  firstName: { label: "First name", headers: ["first name", "firstname", "first"] },
  lastName: { label: "Last name", headers: ["last name", "lastname", "surname", "last"] },
  phone: { label: "Phone", headers: ["phone", "phone number", "phone no", "mobile"] },
  altPhone: { label: "Alt. phone", headers: ["alt phone", "alt. phone", "alternate phone", "alternative phone", "other phone"] },
  email: { label: "Email", headers: ["email", "email address"] },
  address: { label: "Address", headers: ["address", "home address"] },
  gender: { label: "Gender", headers: ["gender", "sex"] },
  status: { label: "Status", headers: ["status"] },
  branch: { label: "Branch", headers: ["branch"] },
  personResponsible: { label: "Person responsible", headers: ["person responsible", "responsible"] },
  notes: { label: "Notes", headers: ["notes", "note"] },
  teams: { label: "Teams", headers: ["teams", "team"] },
} as const
export type UpdateField = keyof typeof UPDATE_FIELDS
type ScalarField = Exclude<UpdateField, "teams">

const ID_HEADERS = ["id", "member id", "member #", "#"]
/** Columns from the Members export that are worked out by the app and can't be changed from a file. */
const READ_ONLY = ["activity", "visits", "streak", "last attended", "first seen", "flags"]

export type ParsedUpdateRow = { row: number; id: number | null; values: Partial<Record<UpdateField, string>> }
export type ParsedUpdates = { rows: ParsedUpdateRow[]; columns: UpdateField[]; ignoredColumns: string[]; hasId: boolean }

export function parseMemberUpdates(grid: string[][]): ParsedUpdates {
  const [headerRow, ...rest] = grid
  if (!headerRow) throw new Error("The file is empty")
  const headers = headerRow.map((h) => h.trim().toLowerCase())
  const idCol = headers.findIndex((h) => ID_HEADERS.includes(h))
  const cols = new Map<UpdateField, number>()
  const ignoredColumns: string[] = []
  headers.forEach((h, i) => {
    if (!h || i === idCol) return
    const field = (Object.keys(UPDATE_FIELDS) as UpdateField[]).find((f) => (UPDATE_FIELDS[f].headers as readonly string[]).includes(h))
    if (field && !cols.has(field)) cols.set(field, i)
    else if (!READ_ONLY.includes(h)) ignoredColumns.push(headerRow[i].trim())
  })
  if (!cols.size) throw new Error("No columns to update. Use the headers from Members → Export CSV (e.g. ID, First Name, Phone, Status).")
  if (idCol < 0 && !cols.has("phone")) throw new Error("Add an ID column (from Members → Export CSV) or a Phone column so each row can be matched to a member.")

  const rows: ParsedUpdateRow[] = []
  rest.forEach((r, i) => {
    if (r.every((c) => !String(c ?? "").trim())) return
    const rawId = idCol >= 0 ? String(r[idCol] ?? "").trim() : ""
    const values: ParsedUpdateRow["values"] = {}
    for (const [f, c] of cols) {
      const v = String(r[c] ?? "").trim()
      if (v) values[f] = v
    }
    rows.push({ row: i + 2, id: /^\d+$/.test(rawId) ? Number(rawId) : rawId ? NaN : null, values })
  })
  return { rows, columns: [...cols.keys()], ignoredColumns, hasId: idCol >= 0 }
}

export type CurrentMember = Pick<Member,
  "id" | "firstName" | "lastName" | "nameKey" | "phone" | "phoneKey" | "altPhone" | "email" | "address" | "gender" |
  "status" | "branch" | "personResponsible" | "notes" | "flags" | "deletedAt"> & { teams: string[] }

export type FieldChange = { field: UpdateField; label: string; before: string | null; after: string | null }
export type MemberUpdate = {
  row: number
  memberId: number
  name: string
  changes: FieldChange[]
  /** Values to save on the member (only changed fields plus derived keys/flags). */
  data: Partial<Member>
  teams: string[] | null
}
export type UpdatePlan = {
  updates: MemberUpdate[]
  unchanged: number
  errors: { row: number; reason: string }[]
  columns: UpdateField[]
  ignoredColumns: string[]
}

const same = (a: string | null | undefined, b: string | null | undefined) => (a ?? "") === (b ?? "")

/** Work out what each row would change. Pure: give it the parsed file, the current members and the allowed statuses. */
export function planMemberUpdates(parsed: ParsedUpdates, members: CurrentMember[], statuses: string[]): UpdatePlan {
  const byId = new Map(members.map((m) => [m.id, m]))
  const byPhone = new Map<string, CurrentMember[]>()
  for (const m of members) {
    if (m.deletedAt || !m.phoneKey) continue
    byPhone.set(m.phoneKey, [...(byPhone.get(m.phoneKey) ?? []), m])
  }
  const errors: UpdatePlan["errors"] = []
  const updates: MemberUpdate[] = []
  const seen = new Map<number, number>()
  // name + phone pairs after this file is applied, to catch two records ending up identical
  const finalKeys = new Map(members.filter((m) => !m.deletedAt && m.phoneKey).map((m) => [m.id, `${m.nameKey}|${m.phoneKey}`]))
  let unchanged = 0

  for (const r of parsed.rows) {
    const fail = (reason: string) => errors.push({ row: r.row, reason })
    let m: CurrentMember | undefined
    if (r.id != null) {
      if (Number.isNaN(r.id)) { fail("ID must be a number"); continue }
      m = byId.get(r.id)
      if (!m) { fail(`No member with ID ${r.id}`); continue }
    } else {
      const ph = normalizePhone(r.values.phone)
      if (!ph.phoneKey) { fail(parsed.hasId ? "No ID, and no valid phone to match on" : "No valid phone to match on"); continue }
      const found = byPhone.get(ph.phoneKey) ?? []
      const first = cleanName(r.values.firstName ?? "")
      const named = first ? found.filter((f) => f.nameKey === nameKey(first, cleanName(r.values.lastName ?? ""))) : []
      m = named.length === 1 ? named[0] : found.length === 1 ? found[0] : undefined
      if (!m) { fail(found.length ? "Several people share this phone: add the ID column to say which one" : "No member with this phone"); continue }
    }
    if (m.deletedAt) { fail(`#${m.id} ${m.firstName} ${m.lastName} is deleted. Restore them first`.trim()); continue }
    if (seen.has(m.id)) { fail(`Same member as row ${seen.get(m.id)} (#${m.id})`); continue }
    seen.set(m.id, r.row)

    const v = r.values
    const next: Record<ScalarField, string | null> = {
      firstName: m.firstName, lastName: m.lastName, phone: m.phone, altPhone: m.altPhone, email: m.email, address: m.address,
      gender: m.gender, status: m.status, branch: m.branch, personResponsible: m.personResponsible, notes: m.notes,
    }
    const problems: string[] = []
    if (v.firstName) next.firstName = cleanName(v.firstName)
    if (v.lastName) next.lastName = cleanName(v.lastName)
    // A number that was already stored as-is (even if not valid) isn't a change, so an untouched export row goes through.
    if (v.phone && v.phone !== m.phone) {
      const ph = normalizePhone(v.phone)
      if (ph.problem) problems.push(`Phone "${v.phone}" isn't a valid 11-digit number`)
      else next.phone = ph.phone
    }
    // A number that was already stored as-is (even if not valid) isn't a change, so an untouched export row goes through.
    if (v.altPhone && v.altPhone !== m.altPhone) {
      const ph = normalizePhone(v.altPhone)
      if (ph.problem) problems.push(`Alt. phone "${v.altPhone}" isn't a valid 11-digit number`)
      else next.altPhone = ph.phone
    }
    if (v.email) {
      const e = cleanEmail(v.email)
      if (!e) problems.push(`Email "${v.email}" isn't valid`)
      else next.email = e
    }
    if (v.gender) {
      const g = cleanGender(v.gender)
      if (!g) problems.push(`Gender "${v.gender}" should be Male or Female`)
      else next.gender = g
    }
    if (v.status) {
      const s = statuses.find((x) => x.toLowerCase() === v.status!.toLowerCase())
      if (!s) problems.push(`Status "${v.status}" isn't one of: ${statuses.join(" · ")}`)
      else next.status = s
    }
    if (v.address) next.address = v.address
    if (v.branch) next.branch = cleanName(v.branch)
    if (v.personResponsible) next.personResponsible = cleanName(v.personResponsible)
    if (v.notes) next.notes = v.notes
    if (problems.length) { fail(problems.join("; ")); continue }

    const changes: FieldChange[] = []
    const data: Partial<Member> = {}
    for (const f of Object.keys(next) as ScalarField[]) {
      if (f in v && !same(next[f], m[f])) {
        changes.push({ field: f, label: UPDATE_FIELDS[f].label, before: m[f], after: next[f] })
        ;(data as Record<string, unknown>)[f] = next[f]
      }
    }
    let teams: string[] | null = null
    if (v.teams) {
      const wanted = splitTeams(v.teams)
      const norm = (a: string[]) => a.map((t) => t.toLowerCase()).sort().join("|")
      if (norm(wanted) !== norm(m.teams)) {
        teams = wanted
        changes.push({ field: "teams", label: "Teams", before: m.teams.join(", ") || null, after: wanted.join(", ") || null })
      }
    }
    if (!changes.length) { unchanged++; continue }

    if ("firstName" in data || "lastName" in data) data.nameKey = nameKey(next.firstName!, next.lastName ?? "")
    if ("phone" in data) data.phoneKey = normalizePhone(next.phone).phoneKey
    if ("lastName" in data || "gender" in data || "phone" in data) {
      const keep = m.flags.filter((f) => !["needs_phone", "short_phone", "bad_phone", "needs_last_name", "needs_gender"].includes(f))
      data.flags = [...flagsFor({ lastName: next.lastName ?? "", gender: next.gender, phoneProblem: normalizePhone(next.phone).problem }), ...keep]
    }
    if (data.nameKey !== undefined || data.phoneKey !== undefined) {
      const key = `${data.nameKey ?? m.nameKey}|${data.phoneKey ?? m.phoneKey}`
      const clash = (data.phoneKey ?? m.phoneKey) ? [...finalKeys].find(([id, k]) => id !== m.id && k === key) : undefined
      if (clash) {
        fail(`Would have the same name and phone as #${clash[0]}. Merge them on the profile instead`)
        continue
      }
      finalKeys.set(m.id, key)
    }
    updates.push({ row: r.row, memberId: m.id, name: `${m.firstName} ${m.lastName}`.trim(), changes, data, teams })
  }
  return { updates, unchanged, errors, columns: parsed.columns, ignoredColumns: parsed.ignoredColumns }
}
