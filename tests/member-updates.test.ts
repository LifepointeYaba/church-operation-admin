import { describe, expect, it } from "vitest"
import { parseMemberUpdates, planMemberUpdates, type CurrentMember } from "@/lib/import/member-updates"

const STATUSES = ["First Timer", "Second Timer", "Regular, not done membership class", "Member", "Worker"]

const member = (over: Partial<CurrentMember> & { id: number }): CurrentMember => ({
  firstName: "Ada", lastName: "Obi", nameKey: "ada obi", phone: "+2348031234567", phoneKey: "+2348031234567", altPhone: null,
  email: null, address: null, gender: "Female", status: "Member", branch: "Main", personResponsible: null, notes: null,
  flags: [], deletedAt: null, teams: [], ...over,
})

const plan = (grid: string[][], members: CurrentMember[]) => planMemberUpdates(parseMemberUpdates(grid), members, STATUSES)

describe("parseMemberUpdates", () => {
  it("reads the Members export headers and skips worked-out columns", () => {
    const p = parseMemberUpdates([["ID", "First Name", "Phone", "Visits", "Streak", "Favourite colour"], ["1", "Ada", "", "3", "2", "red"]])
    expect(p.columns).toEqual(["firstName", "phone"])
    expect(p.ignoredColumns).toEqual(["Favourite colour"])
    expect(p.rows[0]).toEqual({ row: 2, id: 1, values: { firstName: "Ada" } })
  })
  it("needs an ID or Phone column to match rows", () => {
    expect(() => parseMemberUpdates([["First Name", "Status"], ["Ada", "Member"]])).toThrow(/ID column/)
  })
})

describe("planMemberUpdates", () => {
  it("only changes filled-in fields that differ, normalising values", () => {
    const r = plan(
      [["ID", "First Name", "Phone", "Email", "Status", "Address"], ["1", "Ada", "0803 123 4567", "ADA@Mail.com", "worker", ""]],
      [member({ id: 1 })],
    )
    expect(r.errors).toEqual([])
    expect(r.updates).toHaveLength(1)
    expect(r.updates[0].changes.map((c) => [c.field, c.after])).toEqual([["email", "ada@mail.com"], ["status", "Worker"]])
    expect(r.updates[0].data).toEqual({ email: "ada@mail.com", status: "Worker" })
  })
  it("counts rows with nothing new as up to date", () => {
    const r = plan([["ID", "First Name"], ["1", "Ada"]], [member({ id: 1 })])
    expect(r.updates).toEqual([])
    expect(r.unchanged).toBe(1)
  })
  it("matches by phone when there is no ID, and recomputes keys and flags", () => {
    const r = plan([["Phone", "Last Name", "Gender"], ["08031234567", "Obi-Eze", "m"]], [member({ id: 7, flags: ["needs_gender", "shared_phone"] })])
    const u = r.updates[0]
    expect(u.memberId).toBe(7)
    expect(u.data).toMatchObject({ lastName: "Obi-Eze", gender: "Male", nameKey: expect.stringContaining("ada") })
    expect(u.data.flags).toEqual(["shared_phone"])
  })
  it("replaces teams, and No team clears them", () => {
    const r = plan([["ID", "Teams"], ["1", "Choir, Ushering"], ["2", "No team"]], [member({ id: 1, teams: ["Choir"] }), member({ id: 2, phoneKey: null, teams: ["Media"] })])
    expect(r.updates.map((u) => u.teams)).toEqual([["Choir", "Ushering"], []])
  })
  it("skips bad rows with a reason", () => {
    const r = plan(
      [["ID", "Phone", "Status", "Email"], ["99", "", "", ""], ["1", "123", "", ""], ["2", "", "Elder", ""], ["3", "", "", "nope"], ["1", "", "Member", ""], ["x", "", "", ""]],
      [member({ id: 1 }), member({ id: 2, phoneKey: null }), member({ id: 3, phoneKey: null })],
    )
    expect(r.errors.map((e) => [e.row, e.reason.split(/[":]/)[0].trim()])).toEqual([
      [2, "No member with ID 99"], [3, "Phone"], [4, "Status"], [5, "Email"], [6, "Same member as row 3 (#1)"], [7, "ID must be a number"],
    ])
  })
  it("refuses changes that would make two records identical", () => {
    const r = plan([["ID", "First Name", "Last Name"], ["2", "Ada", "Obi"]], [member({ id: 1 }), member({ id: 2, firstName: "Bola", nameKey: "bola obi" })])
    expect(r.updates).toEqual([])
    expect(r.errors[0].reason).toMatch(/same name and phone as #1/)
  })
  it("lets an unchanged invalid phone through", () => {
    const r = plan([["ID", "Phone", "Status"], ["1", "0803 12", "Worker"]], [member({ id: 1, phone: "0803 12", phoneKey: null })])
    expect(r.errors).toEqual([])
    expect(r.updates[0].data).toEqual({ status: "Worker" })
  })
  it("won't update deleted members", () => {
    const r = plan([["ID", "Status"], ["1", "Worker"]], [member({ id: 1, deletedAt: new Date() })])
    expect(r.errors[0].reason).toMatch(/deleted/)
  })
})
