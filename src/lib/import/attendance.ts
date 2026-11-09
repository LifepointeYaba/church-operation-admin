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
  firstTime?: boolean
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
  name: ["name"],
  firstTime: ["first time", "first-time"],
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

export function parseAttendanceGrid(grid: string[][], today = todayLagos(), sundayDate?: string): AttendanceParseResult {
  const [headerRow, ...rows] = grid
  if (!headerRow) throw new Error("The file is empty")
  const headers = headerRow.map((h) => h.trim())
  const nameCol = findCol(headers, COLS.name)
  const firstTimeCol = findCol(headers, COLS.firstTime)
  const weeklyFormat = nameCol >= 0 && firstTimeCol >= 0
  const idx = {
    first: weeklyFormat ? nameCol : findCol(headers, COLS.first),
    last: weeklyFormat ? -1 : findCol(headers, COLS.last),
    phone: findCol(headers, COLS.phone),
    email: findCol(headers, COLS.email),
    team: findCol(headers, COLS.team),
    status: findCol(headers, COLS.status),
    responsible: findCol(headers, COLS.responsible),
    gender: findCol(headers, COLS.gender),
    name: nameCol,
    firstTime: firstTimeCol,
  }
  if (idx.first < 0) throw new Error("Missing 'First Name' column")

  const rejectedColumns: AttendanceParseResult["rejectedColumns"] = []
  const dateCols: { col: number; iso: string }[] = []
  const seen = new Set<string>()
  const known = new Set(Object.values(idx).filter((i) => i >= 0))
  if (weeklyFormat) {
    if (!sundayDate) throw new Error("Select the Sunday date for this weekly attendance file")
    const date = parseSheetDate(sundayDate)
    if (!date) throw new Error("Enter a valid Sunday date")
    const check = checkServiceDate(date, today)
    if (!check.ok) throw new Error(check.reason)
    dateCols.push({ col: -1, iso: isoDate(date) })
  }
  headers.forEach((h, col) => {
    if (known.has(col) || !h) return
    if (weeklyFormat) return rejectedColumns.push({ header: h, reason: "Not a recognised column" })
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
    const fullName = cleanName(get(r, idx.first))
    const [firstName, ...lastParts] = weeklyFormat ? fullName.split(" ") : [fullName]
    const lastName = cleanName(weeklyFormat ? lastParts.join(" ") : get(r, idx.last))
    if (!firstName && !lastName) return rejectedRows.push({ row: rowNo, reason: "No name" })
    let firstTime: boolean | undefined
    if (weeklyFormat) {
      const value = get(r, idx.firstTime).toLowerCase()
      if (value !== "yes" && value !== "no") {
        return rejectedRows.push({ row: rowNo, reason: "First Time must be Yes or No" })
      }
      firstTime = value === "yes"
    }
    const ph = normalizePhone(get(r, idx.phone))
    const gender = cleanGender(get(r, idx.gender))
    const key = `${nameKey(firstName, lastName)}|${ph.phoneKey ?? ""}`
    if (keysSeen.has(key)) {
      return rejectedRows.push({ row: rowNo, reason: `Duplicate of row ${keysSeen.get(key)} (same name and phone)` })
    }
    keysSeen.set(key, rowNo)
    const present = dateCols
      .filter((d) => weeklyFormat || /^(true|yes|y|1|x|present|p)$/i.test(get(r, d.col)))
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
      status: cleanName(get(r, idx.status)) || (firstTime === true ? "First Timer" : weeklyFormat ? "" : "First Timer"),
      personResponsible: cleanName(get(r, idx.responsible)) || null,
      gender,
      flags: flagsFor({ lastName: firstName ? lastName : "", gender, phoneProblem: ph.problem }),
      firstTime,
      present,
    })
  })

  const services = dateCols.map((d) => {
    const presentCount = counts.get(d.iso) ?? 0
    return { date: d.iso, recordTaken: !NO_RECORD_DATES.includes(d.iso) && presentCount > 0, presentCount }
  })
  return { services, people, rejectedColumns, rejectedRows }
}
