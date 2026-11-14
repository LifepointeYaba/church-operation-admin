import { randomBytes } from "node:crypto"
import { z } from "zod"
import type { PrismaClient } from "@prisma/client"
import { prisma } from "./db"
import { audit } from "./audit"
import { normalizePhone } from "./phone"
import { cleanName, nameKey } from "./keys"
import { cleanEmail, cleanGender, flagsFor } from "./import/attendance"
import { syncHeadcountsForMark } from "./headcount-sync"
import { getSettings } from "./settings"
import { isoDate, isSunday, todayLagos } from "./dates"
import { CHURCH_HOME, GROWTH, HOW_HEARD, INTERESTS } from "./first-timers-shared"

/** Links accept answers from the day before their Sunday until 7 days after it. */
const OPENS_DAYS_BEFORE = 1
const CLOSES_DAYS_AFTER = 7

const toDate = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

/** Today if it's Sunday (Lagos time), otherwise the coming Sunday. */
export function upcomingSunday(today = todayLagos()): string {
  const d = new Date(today.getTime() + ((7 - today.getUTCDay()) % 7) * 86400000)
  return isoDate(d)
}

/** Get the link for a Sunday, creating it the first time. */
export async function getOrCreateLink(dateIso: string, createdById?: string) {
  const date = toDate(dateIso)
  if (Number.isNaN(date.getTime()) || !isSunday(date)) throw new Error("Pick a Sunday")
  const existing = await prisma.firstTimerLink.findUnique({ where: { serviceDate: date } })
  if (existing) return { link: existing, created: false }
  const link = await prisma.firstTimerLink.create({
    data: { serviceDate: date, token: randomBytes(9).toString("base64url"), createdById },
  })
  return { link, created: true }
}

export function linkWindow(serviceDate: Date, today = todayLagos()) {
  const opens = new Date(serviceDate.getTime() - OPENS_DAYS_BEFORE * 86400000)
  const closes = new Date(serviceDate.getTime() + CLOSES_DAYS_AFTER * 86400000)
  if (today < opens) return { open: false as const, reason: "not_yet" as const, opens }
  if (today > closes) return { open: false as const, reason: "closed" as const, closes }
  return { open: true as const }
}

const optionOf = (list: string[]) => z.string().trim().optional().transform((v) => (v && list.includes(v) ? v : null))
const text = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null)

export const firstTimerInput = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(100),
  phone: z.string().trim().min(1, "Enter your phone number"),
  email: z.string().trim().max(200).optional().default(""),
  gender: z.string().trim().optional().default(""),
  birthday: z.string().trim().optional().transform((v) => (v && /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(v) ? v : null)),
  address: text(300),
  howHeard: optionOf(HOW_HEARD),
  churchHome: optionOf(CHURCH_HOME),
  interests: z.array(z.string()).optional().default([]).transform((a) => a.filter((v) => INTERESTS.includes(v))),
  growth: z.array(z.string()).optional().default([]).transform((a) => a.filter((v) => GROWTH.includes(v))),
  prayerRequest: text(2000),
  comments: text(2000),
  improve: text(2000),
  onWhatsapp: z.boolean().optional().default(true),
  /** Honeypot: real people never fill this hidden field. */
  website: z.string().optional().default(""),
})
export type FirstTimerInput = z.input<typeof firstTimerInput>

/**
 * Save a first-timer form: match the person by phone (or create them as a First Timer),
 * mark them present for the link's Sunday and keep the weekly headcount in step.
 */
export async function submitFirstTimerForm(token: string, input: FirstTimerInput) {
  const v = firstTimerInput.parse(input)
  const link = await prisma.firstTimerLink.findUnique({ where: { token } })
  if (!link || !link.active) throw new Error("This form link is no longer active.")
  const window = linkWindow(link.serviceDate)
  if (!window.open) throw new Error(window.reason === "closed" ? "This form has closed." : "This form isn't open yet.")
  const firstName = cleanName(v.fullName).split(" ")[0]
  if (v.website) return { firstName } // bot: pretend it worked

  const ph = normalizePhone(v.phone)
  if (!ph.phoneKey) throw new Error("Enter a valid 11-digit phone number, e.g. 0803 123 4567")
  const name = cleanName(v.fullName)
  const lastName = name.split(" ").slice(1).join(" ")
  const email = cleanEmail(v.email)
  const gender = cleanGender(v.gender)
  const dateIso = isoDate(link.serviceDate)

  // Same phone already submitted on this link: don't save twice.
  const already = await prisma.firstTimerResponse.findUnique({ where: { linkId_phoneKey: { linkId: link.id, phoneKey: ph.phoneKey } } })
  if (already) return { firstName }

  const settings = await getSettings()
  const status = settings.statuses.includes("First Timer") ? "First Timer" : settings.statuses[0]
  const matches = await prisma.member.findMany({ where: { deletedAt: null, phoneKey: ph.phoneKey }, orderBy: { id: "asc" } })
  // Prefer the same name on a shared phone; otherwise the only person with this phone.
  const match = matches.find((m) => m.nameKey === nameKey(firstName, lastName)) ?? (matches.length === 1 ? matches[0] : undefined)

  const member = await prisma.$transaction(async (tx) => {
    const service = await tx.service.upsert({
      where: { date: link.serviceDate }, create: { date: link.serviceDate, recordTaken: true }, update: { recordTaken: true },
    })
    let memberId: number
    if (match) {
      memberId = match.id
      const fill: Record<string, string> = {}
      if (!match.email && email) fill.email = email
      if (!match.gender && gender) fill.gender = gender
      if (!match.address && v.address) fill.address = v.address
      if (Object.keys(fill).length) await tx.member.update({ where: { id: match.id }, data: fill })
    } else {
      const created = await tx.member.create({
        data: {
          firstName, lastName, nameKey: nameKey(firstName, lastName), phone: ph.phone, phoneKey: ph.phoneKey,
          email, gender, address: v.address, status, flags: flagsFor({ lastName, gender, phoneProblem: null }),
        },
      })
      await tx.statusHistory.create({ data: { memberId: created.id, old: null, new: status, reason: "First-timer form" } })
      memberId = created.id
    }
    await syncHeadcountsForMark(tx, memberId, dateIso, async () => {
      await tx.attendance.upsert({
        where: { memberId_serviceId: { memberId, serviceId: service.id } },
        create: { memberId, serviceId: service.id },
        update: {},
      })
    })
    await tx.$executeRaw`
      UPDATE members SET first_seen_service_id = (
        SELECT a.service_id FROM attendance a JOIN services s ON s.id = a.service_id
        WHERE a.member_id = ${memberId} ORDER BY s.date LIMIT 1)
      WHERE id = ${memberId}`
    await tx.firstTimerResponse.create({
      data: {
        linkId: link.id, memberId, fullName: name, phone: ph.phone!, phoneKey: ph.phoneKey, email, gender,
        birthday: v.birthday, address: v.address, howHeard: v.howHeard, churchHome: v.churchHome,
        interests: v.interests, growth: v.growth, prayerRequest: v.prayerRequest, comments: v.comments,
        improve: v.improve, onWhatsapp: v.onWhatsapp, matchedExisting: !!match,
      },
    })
    return memberId
  }, { timeout: 20_000, maxWait: 10_000 })

  await audit("first_timer_form", "member", member, null, { date: dateIso, matchedExisting: !!match })
  return { firstName }
}

/** Sundays (of those given) whose first-timer link has at least one registration. */
export async function linkSundaysWithResponses(db: PrismaClient, dates: string[]): Promise<Set<string>> {
  if (!dates.length) return new Set()
  const links = await db.firstTimerLink.findMany({
    where: { serviceDate: { in: dates.map(toDate) }, responses: { some: {} } },
    select: { serviceDate: true },
  })
  return new Set(links.map((l) => isoDate(l.serviceDate)))
}

/**
 * A person in an attendance file who is new (not First Time = No) and unmatched, and whose
 * first Sunday in the file had a first-timer link in use, didn't register on the link:
 * they go to review instead of being created automatically.
 */
export function needsLinkReview(person: { firstTime?: boolean; present: string[] }, linkSundays: Set<string>) {
  if (person.firstTime === false || !person.present.length) return false
  return linkSundays.has([...person.present].sort()[0])
}

/**
 * Undo one form registration: remove the present mark it added (keeping the headcount in step),
 * delete the person if the form created them and they have no other attendance, and remove the
 * Sunday itself if nothing else was recorded on it.
 */
export async function deleteRegistration(responseId: number) {
  const r = await prisma.firstTimerResponse.findUnique({ where: { id: responseId }, include: { link: true } })
  if (!r) throw new Error("Registration not found")
  const dateIso = isoDate(r.link.serviceDate)
  let memberDeleted = false
  await prisma.$transaction(async (tx) => {
    await tx.firstTimerResponse.delete({ where: { id: r.id } })
    const service = await tx.service.findUnique({ where: { date: r.link.serviceDate } })
    if (r.memberId && service) {
      const memberId = r.memberId
      await syncHeadcountsForMark(tx, memberId, dateIso, async () => {
        await tx.attendance.deleteMany({ where: { memberId, serviceId: service.id } })
      })
      const [otherMarks, otherForms] = await Promise.all([
        tx.attendance.count({ where: { memberId } }),
        tx.firstTimerResponse.count({ where: { memberId } }),
      ])
      if (!r.matchedExisting && otherMarks === 0 && otherForms === 0) {
        await tx.member.delete({ where: { id: memberId } })
        memberDeleted = true
      } else {
        await tx.$executeRaw`
          UPDATE members SET first_seen_service_id = (
            SELECT a.service_id FROM attendance a JOIN services s ON s.id = a.service_id
            WHERE a.member_id = ${memberId} ORDER BY s.date LIMIT 1)
          WHERE id = ${memberId}`
      }
    }
    if (service) await removeEmptyService(tx, service.id)
  }, { timeout: 30_000, maxWait: 10_000 })
  await audit("first_timer_registration_delete", "first_timer_response", r.id, { name: r.fullName, phone: r.phone, date: dateIso, memberId: r.memberId }, { memberDeleted })
  return { name: r.fullName, memberDeleted }
}

/** Delete a link, every registration on it and the attendance those registrations added. */
export async function deleteLink(linkId: number) {
  const link = await prisma.firstTimerLink.findUnique({ where: { id: linkId }, include: { responses: { select: { id: true } } } })
  if (!link) throw new Error("Link not found")
  let membersDeleted = 0
  for (const r of link.responses) if ((await deleteRegistration(r.id)).memberDeleted) membersDeleted++
  await prisma.firstTimerLink.delete({ where: { id: linkId } })
  await audit("first_timer_link_delete", "first_timer_link", linkId, { date: isoDate(link.serviceDate), registrations: link.responses.length }, { membersDeleted })
  return { registrations: link.responses.length, membersDeleted }
}

/** A Sunday left with no attendance, notes or hand-entered headcount was only there because of the form. */
async function removeEmptyService(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], serviceId: number) {
  const s = await tx.service.findUnique({
    where: { id: serviceId },
    select: { label: true, _count: { select: { attendance: true, notes: true } }, headcounts: { select: { fromRegister: true, uploadId: true } } },
  })
  if (!s || s._count.attendance || s._count.notes || s.label) return
  if (s.headcounts.some((h) => !h.fromRegister || h.uploadId)) return
  await tx.service.delete({ where: { id: serviceId } })
}
