/**
 * Roles and what each can do. Safe to import from client components (no server code).
 * Roles are fixed in code so permissions can't drift; add a role here to make it available.
 */

export const PERMISSIONS = {
  "dashboard.view": "View the dashboard and trends",
  "members.view": "View member records",
  "members.edit": "Add and edit members and their teams",
  "members.delete": "Delete, restore, merge and erase members; revert changes",
  "members.export": "Export member data",
  "followUps.log": "Log follow-up calls and visits",
  "attendance.mark": "Mark Sunday attendance (and add first timers)",
  "headcount.manage": "Record weekly headcounts and service notes",
  "callLists.view": "View and export call lists",
  "callLists.manage": "Approve or reject suggested status changes",
  "imports.manage": "Upload and import attendance files",
  "settings.manage": "Change thresholds, statuses and teams",
  "audit.view": "View the audit log",
  "users.manage": "Add, edit and remove users",
} as const

export type Permission = keyof typeof PERMISSIONS
const ALL = Object.keys(PERMISSIONS) as Permission[]

export const ROLES = {
  super_admin: {
    label: "Super Admin",
    description: "Full access, including managing other Super Admins.",
    permissions: ALL,
  },
  admin: {
    label: "Admin",
    description: "Full access to church data, settings and users. Cannot manage Super Admins.",
    permissions: ALL,
  },
  pastor: {
    label: "Pastor / Leader",
    description: "Sees everything about the congregation, follows up and approves status changes.",
    permissions: [
      "dashboard.view", "members.view", "members.edit", "members.export", "followUps.log",
      "callLists.view", "callLists.manage", "audit.view",
    ],
  },
  data_officer: {
    label: "Data Officer",
    description: "Keeps records up to date: attendance, headcounts, imports and member details.",
    permissions: [
      "dashboard.view", "members.view", "members.edit", "members.export", "followUps.log",
      "attendance.mark", "headcount.manage", "callLists.view", "imports.manage",
    ],
  },
  follow_up: {
    label: "Follow-up Team",
    description: "Works the call lists and logs follow-ups on member profiles.",
    permissions: ["members.view", "followUps.log", "callLists.view"],
  },
  usher: {
    label: "Usher",
    description: "Marks attendance and records the headcount on Sunday.",
    permissions: ["attendance.mark", "headcount.manage"],
  },
  viewer: {
    label: "Viewer",
    description: "Read-only access to the dashboard, trends, members and call lists.",
    permissions: ["dashboard.view", "members.view", "callLists.view"],
  },
} satisfies Record<string, { label: string; description: string; permissions: readonly Permission[] }>

export type Role = keyof typeof ROLES
export const ROLE_KEYS = Object.keys(ROLES) as Role[]

export const isRole = (r: string): r is Role => r in ROLES
export const roleLabel = (r: string) => (isRole(r) ? ROLES[r].label : r)
export const permissionsOf = (role: string): Permission[] => (isRole(role) ? [...ROLES[role].permissions] : [])
export const roleCan = (role: string, p: Permission) => permissionsOf(role).includes(p)

/** Pages in the order a user lands on after signing in: the first one they can open. */
const HOMES: [Permission, string][] = [
  ["dashboard.view", "/dashboard"],
  ["attendance.mark", "/attendance"],
  ["headcount.manage", "/headcount"],
  ["callLists.view", "/call-lists"],
  ["members.view", "/members"],
  ["imports.manage", "/uploads"],
  ["settings.manage", "/settings"],
  ["users.manage", "/users"],
]
export const homeFor = (role: string) => HOMES.find(([p]) => roleCan(role, p))?.[1] ?? "/account"

/** Only Super Admins may create, change or remove a Super Admin. */
export const canManageRole = (actorRole: string, targetRole: string) =>
  roleCan(actorRole, "users.manage") && (targetRole !== "super_admin" || actorRole === "super_admin")
