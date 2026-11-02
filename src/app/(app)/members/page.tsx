import { requireAdmin } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { activityOf, memberStats, referenceService } from "@/lib/metrics"
import { getSettings } from "@/lib/settings"
import { isoDate } from "@/lib/dates"
import { purgeExpiredDeletes } from "@/lib/members"
import { PageHeader } from "@/components/common"
import { MembersTable, type MemberRow } from "./members-table"
import { AddMemberButton } from "./member-form"

export const metadata = { title: "Members" }

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ q?: string; tab?: string }> }) {
  await requireAdmin()
  await purgeExpiredDeletes()
  const { q, tab } = await searchParams
  const [ref, settings, teams, extra, deleted] = await Promise.all([
    referenceService(),
    getSettings(),
    prisma.team.findMany({ orderBy: { name: "asc" } }),
    prisma.member.findMany({ where: { deletedAt: null }, select: { id: true, email: true, flags: true } }),
    prisma.member.findMany({
      where: { deletedAt: { not: null } },
      select: { id: true, firstName: true, lastName: true, phone: true, status: true, deletedAt: true },
      orderBy: { deletedAt: "desc" },
    }),
  ])
  const stats = ref ? await memberStats(isoDate(ref.date), {}) : []
  const extraById = new Map(extra.map((e) => [e.id, e]))
  const rows: MemberRow[] = stats.map((m) => ({
    id: m.id,
    name: `${m.firstName} ${m.lastName}`.trim(),
    phone: m.phone,
    email: extraById.get(m.id)?.email ?? null,
    status: m.status,
    gender: m.gender,
    teams: m.teams,
    personResponsible: m.personResponsible,
    activity: activityOf(m, settings),
    lastDate: m.lastDate,
    visits: m.visits,
    streak: m.streak,
    flags: extraById.get(m.id)?.flags ?? [],
  }))
  return (
    <>
      <PageHeader
        title="Members"
        description={`${rows.length.toLocaleString()} people · activity as of ${ref ? isoDate(ref.date) : "—"}`}
        actions={<AddMemberButton statuses={settings.statuses} />}
      />
      <MembersTable
        rows={rows}
        initialQuery={q ?? ""}
        initialTab={tab ?? "all"}
        statuses={settings.statuses}
        teams={teams.map((t) => t.name)}
        deleted={deleted.map((d) => ({ ...d, deletedAt: d.deletedAt!.toISOString() }))}
      />
    </>
  )
}
