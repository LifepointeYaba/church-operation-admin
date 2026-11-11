import { requirePermission } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { memberStats, referenceService, servicePoints } from "@/lib/metrics"
import { CALL_LIST_LABELS, callLists, type CallListKey } from "@/lib/metrics/lists"
import { getSettings } from "@/lib/settings"
import { syncSuggestions } from "@/lib/suggestions"
import { formatDate, isoDate } from "@/lib/dates"
import { EmptyState, PageHeader } from "@/components/common"
import { SundayPicker } from "@/components/sunday-picker"
import { CallListTabs, SuggestionReview } from "./call-lists-client"

export const metadata = { title: "Call lists" }

export default async function CallListsPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  await requirePermission("callLists.view")
  const { date } = await searchParams
  const ref = await referenceService(date)
  if (!ref) return <EmptyState title="No attendance yet" />
  const refIso = isoDate(ref.date)
  const [settings, points] = await Promise.all([getSettings(), servicePoints()])
  const stats = await memberStats(refIso, {})
  const lists = callLists(stats, refIso, settings)
  const latest = await referenceService()
  if (latest && isoDate(latest.date) === refIso) await syncSuggestions(stats, settings)
  const suggestions = await prisma.statusSuggestion.findMany({
    where: { state: "pending", member: { deletedAt: null } },
    include: { member: { select: { firstName: true, lastName: true, phone: true } } },
    orderBy: [{ toStatus: "asc" }, { createdAt: "asc" }],
  })
  const order: CallListKey[] = ["firstTimers", "secondTimers", "slippingRegulars", "newlyAtRisk", "newlyInactive", "workersMissed"]
  return (
    <div className="space-y-6">
      <PageHeader
        title="Call lists"
        description={`For Sunday ${formatDate(refIso, "long")}. Export a list to share with whoever is calling, then log outcomes on each profile.`}
        actions={<SundayPicker dates={points.filter((p) => p.recordTaken).map((p) => p.date).reverse()} value={refIso} />}
      />
      <CallListTabs
        date={refIso}
        lists={order.map((k) => ({
          key: k,
          label: CALL_LIST_LABELS[k],
          people: lists[k].map((m) => ({
            id: m.id, name: `${m.firstName} ${m.lastName}`.trim(), phone: m.phone, status: m.status, teams: m.teams,
            personResponsible: m.personResponsible, lastDate: m.lastDate,
          })),
        }))}
      />
      <section id="review" className="scroll-mt-20">
        <h3 className="mb-1 text-lg font-semibold">Suggested status changes ({suggestions.length})</h3>
        <p className="mb-3 text-sm text-muted-foreground">Nothing changes until you approve. “Not Active” is only suggested after {settings.inactiveWeeks} missed Sundays.</p>
        <SuggestionReview
          statuses={settings.statuses}
          items={suggestions.map((s) => ({ id: s.id, memberId: s.memberId, name: `${s.member.firstName} ${s.member.lastName}`.trim(), phone: s.member.phone, from: s.fromStatus, to: s.toStatus, reason: s.reason }))}
        />
      </section>
    </div>
  )
}
