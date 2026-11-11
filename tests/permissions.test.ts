import { describe, expect, it } from "vitest"
import { PERMISSIONS, ROLE_KEYS, ROLES, canManageRole, homeFor, permissionsOf, roleCan } from "@/lib/permissions"
import { generateTempPassword, verifyPassword, hashPassword } from "@/lib/password"

describe("roles", () => {
  it("only grants known permissions", () => {
    for (const r of ROLE_KEYS) for (const p of ROLES[r].permissions) expect(PERMISSIONS).toHaveProperty(p)
  })

  it("gives super admins and admins everything", () => {
    expect(permissionsOf("super_admin")).toHaveLength(Object.keys(PERMISSIONS).length)
    expect(permissionsOf("admin")).toHaveLength(Object.keys(PERMISSIONS).length)
  })

  it("keeps restricted roles restricted", () => {
    expect(roleCan("viewer", "members.edit")).toBe(false)
    expect(roleCan("usher", "members.view")).toBe(false)
    expect(roleCan("usher", "attendance.mark")).toBe(true)
    expect(roleCan("pastor", "users.manage")).toBe(false)
    expect(roleCan("data_officer", "members.delete")).toBe(false)
  })

  it("denies unknown roles", () => {
    expect(permissionsOf("nope")).toEqual([])
    expect(homeFor("nope")).toBe("/account")
  })

  it("lands each role on a page it can open", () => {
    expect(homeFor("admin")).toBe("/dashboard")
    expect(homeFor("usher")).toBe("/attendance")
    expect(homeFor("follow_up")).toBe("/call-lists")
  })

  it("only lets Super Admins manage Super Admins", () => {
    expect(canManageRole("super_admin", "super_admin")).toBe(true)
    expect(canManageRole("admin", "super_admin")).toBe(false)
    expect(canManageRole("admin", "pastor")).toBe(true)
    expect(canManageRole("pastor", "viewer")).toBe(false)
  })
})

describe("temporary passwords", () => {
  it("are readable and unique", () => {
    const seen = new Set<string>()
    for (let i = 0; i < 200; i++) {
      const pw = generateTempPassword()
      expect(pw).toMatch(/^[A-HJ-NP-Za-km-z2-9]{4}-[A-HJ-NP-Za-km-z2-9]{4}-[A-HJ-NP-Za-km-z2-9]{4}$/)
      seen.add(pw)
    }
    expect(seen.size).toBe(200)
  })

  it("verify against their hash", async () => {
    const pw = generateTempPassword()
    const h = await hashPassword(pw)
    expect(await verifyPassword(h, pw)).toBe(true)
    expect(await verifyPassword(h, pw + "x")).toBe(false)
  })
})
