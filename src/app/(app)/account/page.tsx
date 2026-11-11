import { requireUser } from "@/lib/auth"
import { PERMISSIONS, ROLES, isRole, roleLabel } from "@/lib/permissions"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/common"
import { PasswordForm, ProfileForm, ThemeChoice } from "./account-client"

export const metadata = { title: "My account" }

export default async function AccountPage() {
  const user = await requireUser()
  return (
    <div className="stagger space-y-4">
      <PageHeader title="My account" description={user.email} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Name</CardTitle><CardDescription>Shown to admins and in the audit log.</CardDescription></CardHeader>
          <CardContent><ProfileForm name={user.name ?? ""} /></CardContent>
        </Card>
        <Card className="lg:row-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">Your role <Badge variant="secondary">{roleLabel(user.role)}</Badge></CardTitle>
            {isRole(user.role) && <CardDescription>{ROLES[user.role].description}</CardDescription>}
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {user.permissions.map((p) => <li key={p} className="flex gap-2"><span aria-hidden className="text-primary">✓</span>{PERMISSIONS[p]}</li>)}
            </ul>
          </CardContent>
        </Card>
        <Card id="password" className="scroll-mt-20">
          <CardHeader><CardTitle className="text-base">Change password</CardTitle><CardDescription>At least 10 characters. Other sessions are signed out.</CardDescription></CardHeader>
          <CardContent><PasswordForm /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Theme</CardTitle></CardHeader>
          <CardContent><ThemeChoice /></CardContent>
        </Card>
      </div>
    </div>
  )
}
