import Link from "next/link"
import type { Prisma } from "@prisma/client"
import { requireAdmin } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { NativeSelect } from "@/components/native-select"
import { PageHeader } from "@/components/common"

export const metadata = { title: "Audit log" }

const PAGE = 100

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; action?: string; entity?: string; record?: string; page?: string }> }) {
  await requireAdmin()
  const sp = await searchParams
  const page = Math.max(1, Number(sp.page) || 1)
  const where: Prisma.AuditLogWhereInput = {
    ...(sp.action ? { action: sp.action } : {}),
    ...(sp.entity ? { entity: sp.entity } : {}),
    ...(sp.record ? { entityId: sp.record } : {}),
    ...(sp.from || sp.to ? { at: { ...(sp.from ? { gte: new Date(`${sp.from}T00:00:00+01:00`) } : {}), ...(sp.to ? { lte: new Date(`${sp.to}T23:59:59+01:00`) } : {}) } } : {}),
  }
  // Keep 2 years of history.
  await prisma.auditLog.deleteMany({ where: { at: { lt: new Date(Date.now() - 730 * 86400000) } } })
  const [rows, total, actions, entities] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { at: "desc" }, skip: (page - 1) * PAGE, take: PAGE }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
    prisma.auditLog.findMany({ distinct: ["entity"], select: { entity: true }, orderBy: { entity: "asc" } }),
  ])
  const qs = (p: number) => new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([, v]) => v)), page: String(p) }).toString()
  return (
    <div className="stagger space-y-4">
      <PageHeader title="Audit log" description={`${total.toLocaleString()} entries · kept for 2 years`} />
      <form className="flex flex-wrap gap-2">
        <Input type="date" name="from" defaultValue={sp.from} className="h-9 w-40" aria-label="From" />
        <Input type="date" name="to" defaultValue={sp.to} className="h-9 w-40" aria-label="To" />
        <NativeSelect name="action" defaultValue={sp.action ?? ""} aria-label="Action">
          <option value="">All actions</option>
          {actions.map((a) => <option key={a.action}>{a.action}</option>)}
        </NativeSelect>
        <NativeSelect name="entity" defaultValue={sp.entity ?? ""} aria-label="Record type">
          <option value="">All records</option>
          {entities.map((e) => <option key={e.entity}>{e.entity}</option>)}
        </NativeSelect>
        <Input name="record" defaultValue={sp.record} placeholder="Record ID" className="h-9 w-28" aria-label="Record ID" />
        <Button variant="secondary">Filter</Button>
        <Button variant="ghost" asChild><Link href="/settings/audit">Clear</Link></Button>
      </form>
      <Card className="py-0">
        <CardContent className="overflow-x-auto px-0">
          <Table>
            <TableHeader><TableRow><TableHead className="pl-4">When</TableHead><TableHead>Action</TableHead><TableHead>Record</TableHead><TableHead>Change</TableHead><TableHead className="pr-4">IP</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="pl-4 whitespace-nowrap">{r.at.toLocaleString("en-GB", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" })}</TableCell>
                  <TableCell>{r.action}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.entity === "member" && r.entityId ? <Link className="hover:underline" href={`/members/${r.entityId}`}>member #{r.entityId}</Link> : `${r.entity}${r.entityId ? ` ${r.entityId}` : ""}`}
                  </TableCell>
                  <TableCell className="max-w-md">
                    {(r.before || r.after) && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground">View</summary>
                        <pre className="mt-1 max-h-60 overflow-auto rounded bg-muted p-2 whitespace-pre-wrap">{JSON.stringify({ before: r.before, after: r.after }, null, 1)}</pre>
                      </details>
                    )}
                  </TableCell>
                  <TableCell className="pr-4 text-xs text-muted-foreground">{r.ip}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <div className="flex justify-end gap-2">
        {page > 1 && <Button variant="outline" asChild><Link href={`?${qs(page - 1)}`}>Previous</Link></Button>}
        {page * PAGE < total && <Button variant="outline" asChild><Link href={`?${qs(page + 1)}`}>Next</Link></Button>}
      </div>
    </div>
  )
}
