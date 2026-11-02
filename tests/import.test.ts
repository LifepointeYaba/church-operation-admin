import { describe, expect, it } from "vitest"
import { parseAttendanceGrid } from "@/lib/import/attendance"
import { parseHeadcountGrid, validateHeadcount } from "@/lib/import/headcount"
import { utcDate } from "@/lib/dates"

const today = utcDate(2026, 10, 2)

describe("parseAttendanceGrid", () => {
  const grid = [
    ["First Name", "Last Name", "Phone number", "Email", "Team", "Status", "Person Responsible", "Gender", "21-Jul-24", "28-Jul-24", "04-Aug-24", "05-Aug-24"],
    ["Abass", "Olotu", "07051184614", "Nil", "Prayer Team, Media Team", "Worker", "", "Male", "TRUE", "FALSE", "TRUE", "TRUE"],
    ["Abiola", "", "", "", "No Team", "First Timer", "", "", "FALSE", "FALSE", "TRUE", "FALSE"],
  ]
  const r = parseAttendanceGrid(grid, today)
  it("reads services and rejects non-Sunday columns", () => {
    expect(r.services.map((s) => s.date)).toEqual(["2024-07-21", "2024-07-28", "2024-08-04"])
    expect(r.services.find((s) => s.date === "2024-07-28")!.recordTaken).toBe(false)
    expect(r.rejectedColumns[0].header).toBe("05-Aug-24")
  })
  it("normalises people and flags problems", () => {
    expect(r.people[0]).toMatchObject({ phoneKey: "+2347051184614", email: null, teams: ["Prayer Team", "Media Team"], present: ["2024-07-21", "2024-08-04"] })
    expect(r.people[1].flags.sort()).toEqual(["needs_gender", "needs_last_name", "needs_phone"])
    expect(r.people[1].teams).toEqual([])
  })
})

describe("headcounts", () => {
  it("validates totals both ways (4 Jan 2026 example)", () => {
    const v = { workers: 72, members: 30, firstTimers: 8, secondTimers: 4, male: 40, female: 69, children: 5, total: 114 }
    expect(validateHeadcount(utcDate(2026, 0, 4), v, today)).toEqual({ errors: [], warnings: [] })
    expect(validateHeadcount(utcDate(2026, 0, 4), { ...v, total: 115 }, today).warnings).toHaveLength(2)
  })
  it("parses chart blocks and skips blocks with dates outside the titled month", () => {
    const grid = [
      ["AVERAGE ATTENDANCE IN January", "", ""],
      ["", "", ""],
      ["", "4-Jan-2026", "11-Jan-2026"],
      ["Workers ", "72", "82"],
      ["Members", "30", "27"],
      ["First Timers", "8", "9"],
      ["Second Timers", "4", "4"],
      ["Total Number", "114", "122"],
      ["Male", "40", "47"],
      ["Female", "69", "75"],
      ["Children", "5", "3"],
      ["", "Second Timers Distribution", "Abigael Adebolu came 3 Sundays in a row"],
      ["AVERAGE ATTENDANCE IN November", "", ""],
      ["", "1-Nov-2026", "11-Oct-2026"],
      ["Workers ", "68", "69"],
    ]
    const r = parseHeadcountGrid(grid, today)
    expect(r.rows.map((x) => x.date)).toEqual(["2026-01-04", "2026-01-11"])
    expect(r.rows[0].total).toBe(114)
    expect(r.skippedBlocks).toHaveLength(1)
    expect(r.notes.find((n) => n.text.includes("in a row"))!.type).toBe("streak")
  })
  it("parses the simple table layout", () => {
    const r = parseHeadcountGrid(
      [["Date", "Workers", "Members", "First Timers", "Second Timers", "Male", "Female", "Children"], ["2026-11-01", "68", "30", "4", "4", "44", "60", "2"]],
      today,
    )
    expect(r.rows[0]).toMatchObject({ date: "2026-11-01", total: 106, errors: [], warnings: [] })
  })
})
