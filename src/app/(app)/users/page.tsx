import { requirePermission } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { PERMISSIONS, ROLE_KEYS, ROLES, canManageRole, type Permission } from "@/lib/permissions"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PageHeader } from "@/components/common"
import { AddUserButton, UsersTable, type UserRow } from "./users-client"

export const metadata = { title: "Users & roles" }

export default async function UsersPage() {
  const me = await requirePermission("users.manage")
  const users = await prisma.user.findMany({ orderBy: [{ createdAt: "asc" }] })
  const creators = new Map(users.map((u) => [u.id, u.name || u.email]))
  const now = new Date()
  const rows: UserRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    lastLogin: u.lastLogin?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
    createdBy: u.createdById ? creators.get(u.createdById) ?? "Removed user" : null,
    mustChangePassword: u.mustChangePassword,
    tempPasswordExpiresAt: u.tempPasswordExpiresAt?.toISOString() ?? null,
    locked: !!(u.lockedUntil && u.lockedUntil > now),
    isMe: u.id === me.id,
    manageable: u.id !== me.id && canManageRole(me.role, u.role),
  }))
  const assignable = ROLE_KEYS.filter((r) => canManageRole(me.role, r))
  const perms = Object.keys(PERMISSIONS) as Permission[]
  return (
    <div className="stagger space-y-4">
      <PageHeader
        title="Users & roles"
        description={`${users.length} ${users.length === 1 ? "person has" : "people have"} access. New users get a temporary password that works for 20 minutes.`}
        actions={<AddUserButton roles={assignable} />}
      />
      <UsersTable rows={rows} roles={assignable} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">What each role can do</CardTitle>
          <CardDescription>Roles are fixed so access stays predictable. Changing someone’s role applies on their next page load.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Permission</TableHead>
                {ROLE_KEYS.map((r) => <TableHead key={r} className="text-center whitespace-nowrap">{ROLES[r].label}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {perms.map((p) => (
                <TableRow key={p}>
                  <TableCell className="pl-6">{PERMISSIONS[p]}</TableCell>
                  {ROLE_KEYS.map((r) => {
                    const has = (ROLES[r].permissions as readonly Permission[]).includes(p)
                    return (
                      <TableCell key={r} className="text-center">
                        {has ? <span className="font-semibold text-primary" aria-label="Yes">✓</span> : <span className="text-muted-foreground/50" aria-label="No">—</span>}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <ul className="grid gap-2 px-6 pt-4 text-sm sm:grid-cols-2">
            {ROLE_KEYS.map((r) => <li key={r}><span className="font-medium">{ROLES[r].label}:</span> <span className="text-muted-foreground">{ROLES[r].description}</span></li>)}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
