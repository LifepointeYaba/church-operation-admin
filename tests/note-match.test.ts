import { describe, expect, it } from "vitest"
import { parseDistributionLine } from "@/lib/note-match"

const SUNDAY = "2026-10-18"
const PREV = "2026-10-11"
const hits = (text: string, dates: string[]) => {
  const line = parseDistributionLine(text, SUNDAY)
  return line ? dates.filter((d) => line.matches(d, PREV)) : null
}

describe("parseDistributionLine", () => {
  const dates = ["2026-10-11", "2026-09-20", "2026-05-03", "2025-04-20", "2025-11-02", "2026-06-21"]

  it("ignores headings and other notes", () => {
    expect(parseDistributionLine("Second Timers Distribution", SUNDAY)).toBeNull()
    expect(parseDistributionLine("Taiwo God's Heritage came 3 times in a row", SUNDAY)).toBeNull()
  })

  it("reads the count", () => {
    expect(parseDistributionLine("2 returned from 20 September", SUNDAY)?.count).toBe(2)
  })

  it("matches last week to the previous Sunday", () => {
    expect(hits("1 returned from last week", dates)).toEqual(["2026-10-11"])
  })

  it("matches day + month, with or without 'returned' and abbreviations", () => {
    expect(hits("2 returned from 20 September", dates)).toEqual(["2026-09-20"])
    expect(hits("1 from 20 Sept", dates)).toEqual(["2026-09-20"])
    expect(hits("1 returned from 3 May", dates)).toEqual(["2026-05-03"])
    expect(hits("1 returned from 21 June", dates)).toEqual(["2026-06-21"])
  })

  it("puts a day + month after the Sunday in the previous year", () => {
    expect(hits("1 returned from 2 Nov", dates)).toEqual(["2025-11-02"])
  })

  it("matches month + year and last year", () => {
    expect(hits("1 returned from Apr '25", dates)).toEqual(["2025-04-20"])
    expect(hits("1 returned from April 2025", dates)).toEqual(["2025-04-20"])
    expect(hits("1 returned from last year", dates)).toEqual(["2025-04-20", "2025-11-02"])
  })
})
