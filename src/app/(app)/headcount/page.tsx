import { requireAdmin } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { formatDate, isoDate, lastSunday } from "@/lib/dates"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/common"
import { HeadcountForm, HeadcountUpload, NotesList } from "./headcount-client"

export const metadata = { title: "Weekly headcount" }

export default async function HeadcountPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  await requireAdmin()
  const { date } = await searchParams
  const services = await prisma.service.findMany({
    orderBy: { date: "desc" },
    include: {
      headcounts: { orderBy: { version: "desc" } },
      notes: { orderBy: { id: "asc" } },
      _count: { select: { attendance: true } },
    },
  })
  const sunday = isoDate(lastSunday())
  const recent = [...new Set([sunday, ...services.map((s) => isoDate(s.date))])].sort().reverse().slice(0, 20)
  const chosen = date ?? sunday
  const current = services.find((s) => isoDate(s.date) === chosen)
  const cur = current?.headcounts.find((h) => h.isCurrent)
  const withCounts = services.filter((s) => s.headcounts.length)
  return (
    <div className="stagger space-y-4">
      <PageHeader title="Weekly headcount" description="Enter Sunday's numbers or upload the Chart sheet. Replacing a Sunday keeps the old version." />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Enter headcount</CardTitle>
            <CardDescription>Total is calculated. We warn if Male + Female + Children doesn&apos;t match.</CardDescription>
          </CardHeader>
          <CardContent>
            <HeadcountForm
              key={chosen}
              date={chosen}
              dates={recent}
              existing={cur ? { workers: cur.workers, members: cur.members, firstTimers: cur.firstTimers, secondTimers: cur.secondTimers, male: cur.male, female: cur.female, children: cur.children, total: cur.total } : null}
              registered={current?._count.attendance ?? 0}
            />
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-medium">Notes for {formatDate(chosen, "long")}</h3>
              <NotesList date={chosen} notes={(current?.notes ?? []).map((n) => ({ id: n.id, type: n.type, text: n.text }))} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload CSV or Excel</CardTitle>
            <CardDescription>Chart-sheet layout (one or many months) or a table with columns Date, Workers, Members, First Timers, Second Timers, Male, Female, Children, Notes.</CardDescription>
          </CardHeader>
          <CardContent><HeadcountUpload /></CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">All Sundays with a headcount ({withCounts.length})</CardTitle></CardHeader>
        <CardContent className="px-0">
          <div className="max-h-[60vh] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead className="pl-6">Sunday</TableHead>
                  {["Workers", "Members", "1st", "2nd", "Total", "Male", "Female", "Children", "Registered"].map((h) => <TableHead key={h} className="text-right">{h}</TableHead>)}
                  <TableHead className="pr-6">Versions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withCounts.map((s) => {
                  const h = s.headcounts.find((x) => x.isCurrent) ?? s.headcounts[0]
                  const mismatch = h.male + h.female + h.children !== h.total
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="pl-6 whitespace-nowrap"><a className="hover:underline" href={`/headcount?date=${isoDate(s.date)}`}>{formatDate(s.date, "long")}</a></TableCell>
                      {[h.workers, h.members, h.firstTimers, h.secondTimers].map((v, i) => <TableCell key={i} className="text-right tabular-nums">{v}</TableCell>)}
                      <TableCell className="text-right font-semibold tabular-nums">{h.total}</TableCell>
                      {[h.male, h.female, h.children].map((v, i) => <TableCell key={i} className="text-right tabular-nums">{v}</TableCell>)}
                      <TableCell className="text-right tabular-nums text-muted-foreground">{s._count.attendance}</TableCell>
                      <TableCell className="pr-6">
                        <div className="flex gap-1">
                          {s.headcounts.length > 1 && <Badge variant="outline">v{h.version} of {s.headcounts.length}</Badge>}
                          {mismatch && <Badge variant="outline" className="text-status-warn">Gender split ≠ total</Badge>}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
