import { Download } from "lucide-react"
import { Prisma } from "@prisma/client"
import { requireAdmin } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { blobConfigured } from "@/lib/blob"
import { getSettings } from "@/lib/settings"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { EmptyState, PageHeader } from "@/components/common"
import { AttendanceImport } from "./import-client"
import { PendingAttendanceReviews } from "./pending-reviews"

export const metadata = { title: "Uploads & import" }

export default async function UploadsPage() {
  await requireAdmin()
  const [uploads, settings] = await Promise.all([
    prisma.upload.findMany({ orderBy: { uploadedAt: "desc" }, take: 200 }),
    getSettings(),
  ])
  const pendingUploads = uploads.flatMap((upload) => {
    const summary = upload.summary
    if (!summary || typeof summary !== "object" || Array.isArray(summary)) return []
    const pending = (summary as Prisma.JsonObject).membersPendingApproval
    if (!Array.isArray(pending)) return []
    const people = pending.flatMap((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return []
      const entry = item as Prisma.JsonObject
      const person = entry.person
      if (!person || typeof person !== "object" || Array.isArray(person)) return []
      const details = person as Prisma.JsonObject
      if (typeof entry.row !== "number" || typeof details.firstName !== "string" || typeof details.lastName !== "string") return []
      return [{
        row: entry.row,
        name: `${details.firstName} ${details.lastName}`.trim(),
        phone: typeof details.phone === "string" ? details.phone : null,
        email: typeof details.email === "string" ? details.email : null,
        gender: typeof details.gender === "string" ? details.gender : null,
      }]
    })
    return people.length ? [{ id: upload.id, fileName: upload.fileName, people }] : []
  })
  return (
    <div className="stagger space-y-4">
      <PageHeader title="Uploads & import" description="Re-importing updates matching people (name + phone) and Sundays instead of duplicating them." />
      {!blobConfigured() && (
        <Alert><AlertDescription>Vercel Blob is not connected yet, so original files are not stored. Add BLOB_READ_WRITE_TOKEN to keep downloadable copies.</AlertDescription></Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import attendance file</CardTitle>
          <CardDescription>Upload the standard sheet with one TRUE/FALSE column per Sunday, or a weekly sheet with Name, Phone, Gender, and First Time (Yes/No). For weekly sheets, select the Sunday date above; the first word in Name is treated as the first name. Yes creates a First Timer record. No updates a matching person; unmatched people wait for approval or rejection below.</CardDescription>
        </CardHeader>
        <CardContent><AttendanceImport /></CardContent>
      </Card>
      {pendingUploads.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending member approvals</CardTitle>
            <CardDescription>These attendees were marked First Time = No but did not match a registered person. Search existing members by name, phone, or email to link the attendance and fill blank profile details, or create a new record or reject the row.</CardDescription>
          </CardHeader>
          <CardContent><PendingAttendanceReviews uploads={pendingUploads} statuses={settings.statuses} /></CardContent>
        </Card>
      )}
      <Card>
        <CardHeader><CardTitle className="text-base">Upload history</CardTitle></CardHeader>
        <CardContent className="px-0">
          {uploads.length === 0 ? <div className="px-6"><EmptyState title="No uploads yet" /></div> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Date</TableHead><TableHead>Type</TableHead><TableHead>File</TableHead>
                  <TableHead className="text-right">Saved</TableHead><TableHead className="text-right">Failed</TableHead><TableHead>Status</TableHead><TableHead className="pr-6" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {uploads.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="pl-6 whitespace-nowrap">{u.uploadedAt.toLocaleString("en-GB", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" })}</TableCell>
                    <TableCell className="capitalize">{u.kind}</TableCell>
                    <TableCell className="max-w-64 truncate">{u.fileName}</TableCell>
                    <TableCell className="text-right tabular-nums">{u.rowsOk}</TableCell>
                    <TableCell className="text-right tabular-nums">{u.rowsFailed}</TableCell>
                    <TableCell><Badge variant={u.status === "completed" ? "secondary" : u.status === "failed" ? "destructive" : "outline"}>{u.status}</Badge></TableCell>
                    <TableCell className="pr-6 text-right">
                      {u.blobUrl && <Button size="sm" variant="ghost" asChild><a href={`/api/uploads/${u.id}`}><Download className="size-4" /> Original</a></Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
