import { requirePermission } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getSettings } from "@/lib/settings"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/common"
import { StatusesForm, TeamsManager, ThresholdsForm } from "./settings-client"

export const metadata = { title: "Settings" }

export default async function SettingsPage() {
  await requirePermission("settings.manage")
  const [settings, teams] = await Promise.all([
    getSettings(),
    prisma.team.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { members: true } } } }),
  ])
  return (
    <div className="stagger space-y-4">
      <PageHeader title="Settings" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Activity thresholds</CardTitle><CardDescription>Used by the dashboard, trends and call lists.</CardDescription></CardHeader>
          <CardContent><ThresholdsForm initial={settings} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Statuses</CardTitle><CardDescription>One per line, in journey order.</CardDescription></CardHeader>
          <CardContent><StatusesForm initial={settings.statuses} /></CardContent>
        </Card>
        <Card className="lg:row-span-2">
          <CardHeader><CardTitle className="text-base">Teams</CardTitle><CardDescription>Rename a team to an existing name to merge them.</CardDescription></CardHeader>
          <CardContent><TeamsManager teams={teams.map((t) => ({ id: t.id, name: t.name, count: t._count.members }))} /></CardContent>
        </Card>
      </div>
    </div>
  )
}
