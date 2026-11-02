import { describe, expect, it } from "vitest"
import { displayPhone, normalizePhone } from "@/lib/phone"
import { nameKey } from "@/lib/keys"
import { checkServiceDate, parseSheetDate, isoDate, utcDate } from "@/lib/dates"

describe("normalizePhone", () => {
  it("converts local 11-digit numbers to +234", () => {
    expect(normalizePhone("07051184614").phoneKey).toBe("+2347051184614")
    expect(normalizePhone(" 0705 118 4614 ").phoneKey).toBe("+2347051184614")
    expect(normalizePhone("+2347051184614").phoneKey).toBe("+2347051184614")
    expect(normalizePhone("7051184614").phoneKey).toBe("+2347051184614")
  })
  it("flags missing, short and invalid numbers", () => {
    expect(normalizePhone("").problem).toBe("missing")
    expect(normalizePhone("802076167").problem).toBe("short")
    expect(normalizePhone("81567458723").problem).toBe("invalid")
    expect(normalizePhone("81567458723").phoneKey).toBeNull()
  })
  it("formats for display", () => {
    expect(displayPhone("+2347051184614")).toBe("0705 118 4614")
  })
})

describe("nameKey", () => {
  it("trims, lower-cases and single-spaces", () => {
    expect(nameKey("  Abel   Oluwatosin ", "Olayiwola ")).toBe("abel oluwatosin olayiwola")
    expect(nameKey("Abiola", "")).toBe("abiola")
  })
})

describe("dates", () => {
  it("parses sheet formats", () => {
    expect(isoDate(parseSheetDate("21-Jul-24")!)).toBe("2024-07-21")
    expect(isoDate(parseSheetDate("4-Jan-2026")!)).toBe("2026-01-04")
    expect(isoDate(parseSheetDate("2026-11-01")!)).toBe("2026-11-01")
    expect(parseSheetDate("31-Feb-26")).toBeNull()
  })
  it("rejects non-Sundays and future dates", () => {
    const today = utcDate(2026, 10, 2)
    expect(checkServiceDate(utcDate(2026, 10, 1), today).ok).toBe(true)
    expect(checkServiceDate(utcDate(2026, 10, 3), today).ok).toBe(false)
    expect(checkServiceDate(utcDate(2026, 10, 8), today).ok).toBe(false)
  })
})
