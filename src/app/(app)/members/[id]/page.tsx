import { Fragment } from "react"
import { notFound } from "next/navigation"
import { requirePermission } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { activityOf, memberStats, referenceService } from "@/lib/metrics"
import { getSettings } from "@/lib/settings"
import { formatDate, isoDate } from "@/lib/dates"
import { displayPhone } from "@/lib/phone"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ActivityLabel, FLAG_LABELS, StatusBadge } from "@/components/common"
import { AttendanceStrip, FollowUpForm, ProfileActions, RevertButton, TeamsEditor } from "./profile-client"

export const metadata = { title: "Member profile" }

const show = (v: unknown) => (v == null || v === "" ? "—" : String(v))
const FIELD_LABELS: Record<string, string> = {
  firstName: "First name", lastName: "Last name", phone: "Phone", altPhone: "Alt. phone", email: "Email", address: "Address",
  gender: "Gender", status: "Status", branch: "Branch", personResponsible: "Person responsible", notes: "Notes", teams: "Teams",
}

export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("members.view")
  const id = Number((await params).id)
  if (!Number.isInteger(id)) notFound()
  const member = await prisma.member.findUnique({
    where: { id },
    include: {
      teams: { include: { team: true } },
      statusHistory: { orderBy: { changedAt: "desc" } },
      followUps: { orderBy: { date: "desc" } },
      attendance: { select: { serviceId: true } },
    },
  })
  if (!member) notFound()
  const [services, settings, ref, allTeams, history] = await Promise.all([
    prisma.service.findMany({ orderBy: { date: "asc" } }),
    getSettings(),
    referenceService(),
    prisma.team.findMany({ orderBy: { name: "asc" } }),
    prisma.auditLog.findMany({ where: { entity: "member", entityId: String(id) }, orderBy: { at: "desc" }, take: 50 }),
  ])
  const stat = ref ? (await memberStats(isoDate(ref.date), {})).find((m) => m.id === id) : undefined
  const present = new Set(member.attendance.map((a) => a.serviceId))
  const strip = services.map((s) => ({ date: isoDate(s.date), recordTaken: s.recordTaken, present: present.has(s.id) }))

  const details: [string, React.ReactNode][] = [
    ["Phone", <span key="p" className="tabular-nums">{displayPhone(member.phone) || "—"}</span>],
    ["Alt. phone", displayPhone(member.altPhone) || "—"],
    ["Email", show(member.email)],
    ["Gender", show(member.gender)],
    ["Address", show(member.address)],
    ["Branch", member.branch],
    ["Person responsible", show(member.personResponsible)],
    ["Notes", show(member.notes)],
  ]

  return (
    <div className="stagger space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{member.firstName} {member.lastName}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={member.status} />
            {stat && <ActivityLabel activity={activityOf(stat, settings)} />}
            {member.deletedAt && <Badge variant="destructive">Deleted {formatDate(member.deletedAt, "long")}</Badge>}
            {member.flags.map((f) => <Badge key={f} variant="outline">{FLAG_LABELS[f] ?? f}</Badge>)}
          </div>
        </div>
        <ProfileActions
          memberId={id}
          statuses={settings.statuses}
          deleted={!!member.deletedAt}
          initial={{
            firstName: member.firstName, lastName: member.lastName, phone: member.phone ?? "", altPhone: member.altPhone ?? "",
            email: member.email ?? "", address: member.address ?? "", gender: member.gender ?? "", status: member.status,
            branch: member.branch, personResponsible: member.personResponsible ?? "", notes: member.notes ?? "",
          }}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          ["Visits", stat?.visits ?? 0],
          ["Current streak", stat?.streak ?? 0],
          ["Last attended", stat?.lastDate ? formatDate(stat.lastDate, "long") : "Never"],
          ["First seen", stat?.firstDate ? formatDate(stat.firstDate, "long") : "—"],
        ].map(([l, v]) => (
          <Card key={l as string} className="gap-1 py-3"><CardContent className="px-4">
            <div className="text-sm text-muted-foreground">{l}</div>
            <div className="text-xl font-semibold tabular-nums">{v}</div>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Attendance ({strip.length} Sundays)</CardTitle></CardHeader>
        <CardContent><AttendanceStrip items={strip} /></CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              {details.map(([k, v]) => (<Fragment key={k}><dt className="text-muted-foreground">{k}</dt><dd className="break-words">{v}</dd></Fragment>))}
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Teams</CardTitle></CardHeader>
          <CardContent>
            <TeamsEditor memberId={id} current={member.teams.map((t) => t.team.name)} all={allTeams.map((t) => t.name)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Follow-ups</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <FollowUpForm memberId={id} />
            {member.followUps.length === 0 ? <p className="text-sm text-muted-foreground">No follow-ups logged yet.</p> : (
              <ul className="divide-y text-sm">
                {member.followUps.map((f) => (
                  <li key={f.id} className="py-2">
                    <div className="flex justify-between gap-2"><span className="font-medium">{f.method} · {f.outcome}</span><span className="text-muted-foreground">{formatDate(f.date, "long")}</span></div>
                    {f.note && <p className="text-muted-foreground">{f.note}</p>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Status history</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {member.statusHistory.map((h) => (
                <li key={h.id} className="flex justify-between gap-2 py-2">
                  <span>{h.old ? <>{h.old} → </> : null}<span className="font-medium">{h.new}</span>{h.reason && <span className="text-muted-foreground"> · {h.reason}</span>}</span>
                  <span className="shrink-0 text-muted-foreground">{formatDate(h.changedAt, "long")}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Change history</CardTitle></CardHeader>
        <CardContent>
          {history.length === 0 ? <p className="text-sm text-muted-foreground">No changes recorded.</p> : (
            <ul className="divide-y text-sm">
              {history.map((h) => {
                const before = (h.before ?? {}) as Record<string, unknown>
                const after = (h.after ?? {}) as Record<string, unknown>
                const changed = Object.keys(FIELD_LABELS).filter((k) => k in after && JSON.stringify(before[k] ?? null) !== JSON.stringify(after[k] ?? null))
                return (
                  <li key={h.id} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <span className="font-medium capitalize">{h.action.replace("_", " ")}</span>
                      <span className="text-muted-foreground"> · {h.at.toLocaleString("en-GB", { timeZone: "Africa/Lagos" })}</span>
                      {h.action === "update" && changed.length > 0 && (
                        <ul className="mt-1 text-muted-foreground">
                          {changed.map((k) => <li key={k}>{FIELD_LABELS[k]}: {show(Array.isArray(before[k]) ? (before[k] as string[]).join(", ") : before[k])} → <span className="text-foreground">{show(Array.isArray(after[k]) ? (after[k] as string[]).join(", ") : after[k])}</span></li>)}
                        </ul>
                      )}
                    </div>
                    {h.action === "update" && changed.length > 0 && <RevertButton auditId={h.id} />}
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
