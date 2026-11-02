import { normalizePhone } from "../phone"
import { cleanName, nameKey } from "../keys"
import { checkServiceDate, isoDate, parseSheetDate, todayLagos } from "../dates"

export const NO_RECORD_DATES = ["2024-07-28"]

export type ParsedService = { date: string; recordTaken: boolean; presentCount: number }

export type ParsedPerson = {
  row: number
  firstName: string
  lastName: string
  nameKey: string
  phone: string | null
  phoneKey: string | null
  email: string | null
  teams: string[]
  status: string
  personResponsible: string | null
  gender: string | null
  flags: string[]
  /** ISO dates the person was marked present. */
  present: string[]
}

export type AttendanceParseResult = {
  services: ParsedService[]
  people: ParsedPerson[]
  rejectedColumns: { header: string; reason: string }[]
  rejectedRows: { row: number; reason: string }[]
}

const COLS = {
  first: ["first name", "firstname", "first"],
  last: ["last name", "lastname", "surname", "last"],
  phone: ["phone number", "phone", "phone no", "mobile"],
  email: ["email", "email address"],
  team: ["team", "teams"],
  status: ["status"],
  responsible: ["person responsible", "responsible"],
  gender: ["gender", "sex"],
}

function findCol(headers: string[], names: string[]) {
  return headers.findIndex((h) => names.includes(h.trim().toLowerCase()))
}

export function cleanEmail(raw: string | null | undefined): string | null {
  const e = (raw ?? "").trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e.toLowerCase() : null
}

export function splitTeams(raw: string | null | undefined): string[] {
  return (raw ?? "")
    .split(/[,;/]/)
    .map((t) => cleanName(t))
    .filter((t) => t && t.toLowerCase() !== "no team")
}

export function cleanGender(raw: string | null | undefined): string | null {
  const g = (raw ?? "").trim().toLowerCase()
  if (g.startsWith("m")) return "Male"
  if (g.startsWith("f")) return "Female"
  return null
}

export function flagsFor(p: { lastName: string; gender: string | null; phoneProblem: string | null }): string[] {
  const flags: string[] = []
  if (p.phoneProblem === "missing") flags.push("needs_phone")
  if (p.phoneProblem === "short") flags.push("short_phone")
  if (p.phoneProblem === "invalid") flags.push("bad_phone")
  if (!p.lastName) flags.push("needs_last_name")
  if (!p.gender) flags.push("needs_gender")
  return flags
}

export function parseAttendanceGrid(grid: string[][], today = todayLagos()): AttendanceParseResult {
  const [headerRow, ...rows] = grid
  const headers = headerRow.map((h) => h.trim())
  const idx = {
    first: findCol(headers, COLS.first),
    last: findCol(headers, COLS.last),
    phone: findCol(headers, COLS.phone),
    email: findCol(headers, COLS.email),
    team: findCol(headers, COLS.team),
    status: findCol(headers, COLS.status),
    responsible: findCol(headers, COLS.responsible),
    gender: findCol(headers, COLS.gender),
  }
  if (idx.first < 0) throw new Error("Missing 'First Name' column")

  const rejectedColumns: AttendanceParseResult["rejectedColumns"] = []
  const dateCols: { col: number; iso: string }[] = []
  const seen = new Set<string>()
  const known = new Set(Object.values(idx).filter((i) => i >= 0))
  headers.forEach((h, col) => {
    if (known.has(col) || !h) return
    const d = parseSheetDate(h)
    if (!d) return rejectedColumns.push({ header: h, reason: "Not a recognised date" })
    const check = checkServiceDate(d, today)
    if (!check.ok) return rejectedColumns.push({ header: h, reason: check.reason })
    const iso = isoDate(d)
    if (seen.has(iso)) return rejectedColumns.push({ header: h, reason: "Duplicate date column" })
    seen.add(iso)
    dateCols.push({ col, iso })
  })

  const counts = new Map<string, number>(dateCols.map((d) => [d.iso, 0]))
  const people: ParsedPerson[] = []
  const rejectedRows: AttendanceParseResult["rejectedRows"] = []
  const keysSeen = new Map<string, number>()
  const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "")

  rows.forEach((r, i) => {
    const rowNo = i + 2
    if (r.every((c) => !c.trim())) return
    const firstName = cleanName(get(r, idx.first))
    const lastName = cleanName(get(r, idx.last))
    if (!firstName && !lastName) return rejectedRows.push({ row: rowNo, reason: "No name" })
    const ph = normalizePhone(get(r, idx.phone))
    const gender = cleanGender(get(r, idx.gender))
    const key = `${nameKey(firstName, lastName)}|${ph.phoneKey ?? ""}`
    if (keysSeen.has(key)) {
      return rejectedRows.push({ row: rowNo, reason: `Duplicate of row ${keysSeen.get(key)} (same name and phone)` })
    }
    keysSeen.set(key, rowNo)
    const present = dateCols
      .filter((d) => /^(true|yes|y|1|x|present|p)$/i.test(get(r, d.col)))
      .map((d) => d.iso)
      .filter((iso) => !NO_RECORD_DATES.includes(iso))
    present.forEach((iso) => counts.set(iso, (counts.get(iso) ?? 0) + 1))
    people.push({
      row: rowNo,
      firstName: firstName || lastName,
      lastName: firstName ? lastName : "",
      nameKey: nameKey(firstName, lastName),
      phone: ph.phone,
      phoneKey: ph.phoneKey,
      email: cleanEmail(get(r, idx.email)),
      teams: splitTeams(get(r, idx.team)),
      status: cleanName(get(r, idx.status)) || "First Timer",
      personResponsible: cleanName(get(r, idx.responsible)) || null,
      gender,
      flags: flagsFor({ lastName: firstName ? lastName : "", gender, phoneProblem: ph.problem }),
      present,
    })
  })

  const services = dateCols.map((d) => {
    const presentCount = counts.get(d.iso) ?? 0
    return { date: d.iso, recordTaken: !NO_RECORD_DATES.includes(d.iso) && presentCount > 0, presentCount }
  })
  return { services, people, rejectedColumns, rejectedRows }
}
