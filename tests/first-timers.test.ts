import { describe, expect, it } from "vitest"
import { firstTimerInput, linkWindow, needsLinkReview, upcomingSunday } from "@/lib/first-timers"
import { fillTemplate, whatsappLink } from "@/lib/first-timers-shared"

const d = (iso: string) => new Date(`${iso}T00:00:00Z`)

describe("upcomingSunday", () => {
  it("is today on a Sunday", () => expect(upcomingSunday(d("2026-11-15"))).toBe("2026-11-15"))
  it("is the coming Sunday otherwise", () => {
    expect(upcomingSunday(d("2026-11-14"))).toBe("2026-11-15")
    expect(upcomingSunday(d("2026-11-16"))).toBe("2026-11-22")
  })
})

describe("linkWindow", () => {
  const sunday = d("2026-11-15")
  it("opens the day before", () => {
    expect(linkWindow(sunday, d("2026-11-13")).open).toBe(false)
    expect(linkWindow(sunday, d("2026-11-14")).open).toBe(true)
  })
  it("closes 7 days after", () => {
    expect(linkWindow(sunday, d("2026-11-22")).open).toBe(true)
    expect(linkWindow(sunday, d("2026-11-23"))).toMatchObject({ open: false, reason: "closed" })
  })
})

describe("needsLinkReview (upload of a Sunday that had a first-timer link)", () => {
  const linkSundays = new Set(["2026-11-15"])
  it("sends unmatched first timers on a link Sunday to review", () => {
    expect(needsLinkReview({ firstTime: true, present: ["2026-11-15"] }, linkSundays)).toBe(true)
    expect(needsLinkReview({ present: ["2026-11-15"] }, linkSundays)).toBe(true)
  })
  it("leaves other Sundays and First Time = No alone", () => {
    expect(needsLinkReview({ firstTime: true, present: ["2026-11-08"] }, linkSundays)).toBe(false)
    expect(needsLinkReview({ firstTime: false, present: ["2026-11-15"] }, linkSundays)).toBe(false)
    expect(needsLinkReview({ present: ["2026-11-08", "2026-11-15"] }, linkSundays)).toBe(false)
  })
})

describe("whatsapp", () => {
  it("builds a wa.me link with the message", () => {
    expect(whatsappLink("+2348031234567", "Hi Jane")).toBe("https://wa.me/2348031234567?text=Hi%20Jane")
    expect(whatsappLink("08031234567", "x")).toBe("https://wa.me/2348031234567?text=x")
    expect(whatsappLink(null, "x")).toBeNull()
  })
  it("fills the template", () => {
    expect(fillTemplate("Hi {firstName}, see you {sunday}. {firstName}!", { firstName: "Ada", sunday: "15 Nov" })).toBe("Hi Ada, see you 15 Nov. Ada!")
  })
})

describe("firstTimerInput", () => {
  it("keeps only known options and valid birthdays", () => {
    const v = firstTimerInput.parse({
      fullName: "Jane Doe", phone: "0803 123 4567", birthday: "13-40", howHeard: "Hacker", interests: ["Join Lifegroup", "Free money"],
    })
    expect(v.birthday).toBeNull()
    expect(v.howHeard).toBeNull()
    expect(v.interests).toEqual(["Join Lifegroup"])
    expect(firstTimerInput.parse({ fullName: "Jane Doe", phone: "1", birthday: "08-15" }).birthday).toBe("08-15")
  })
  it("requires a name", () => expect(() => firstTimerInput.parse({ fullName: "", phone: "0803" })).toThrow())
})
