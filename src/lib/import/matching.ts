import type { ParsedPerson } from "./attendance"

export type ExistingAttendanceMember = {
  id: number
  nameKey: string
  phoneKey: string | null
  email: string | null
  gender?: string | null
  personResponsible?: string | null
}

export type AttendanceMatch =
  | { kind: "matched"; member: ExistingAttendanceMember }
  | { kind: "ambiguous"; reason: "contact" | "name" }
  | { kind: "unmatched" }

export function matchAttendancePerson(
  person: ParsedPerson,
  members: ExistingAttendanceMember[],
): AttendanceMatch {
  const contactMatches = new Map<number, ExistingAttendanceMember>()
  for (const member of members) {
    const phoneMatches = !!person.phoneKey && member.phoneKey === person.phoneKey
    const emailMatches = !!person.email && member.email?.trim().toLowerCase() === person.email.toLowerCase()
    if (phoneMatches || emailMatches) contactMatches.set(member.id, member)
  }
  if (contactMatches.size === 1) return { kind: "matched", member: contactMatches.values().next().value! }
  if (contactMatches.size > 1) return { kind: "ambiguous", reason: "contact" }

  if (!person.phoneKey) {
    const nameMatches = members.filter((member) => member.nameKey === person.nameKey && !member.phoneKey)
    if (nameMatches.length === 1) return { kind: "matched", member: nameMatches[0] }
    if (nameMatches.length > 1) return { kind: "ambiguous", reason: "name" }
  }
  return { kind: "unmatched" }
}
