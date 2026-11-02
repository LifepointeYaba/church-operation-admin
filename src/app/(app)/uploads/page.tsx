import { Download } from "lucide-react"
import { requireAdmin } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { blobConfigured } from "@/lib/blob"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { EmptyState, PageHeader } from "@/components/common"
import { AttendanceImport } from "./import-client"

export const metadata = { title: "Uploads & import" }

export default async function UploadsPage() {
  await requireAdmin()
  const uploads = await prisma.upload.findMany({ orderBy: { uploadedAt: "desc" }, take: 200 })
  return (
    <div className="stagger space-y-4">
      <PageHeader title="Uploads & import" description="Re-importing updates matching people (name + phone) and Sundays instead of duplicating them." />
      {!blobConfigured() && (
        <Alert><AlertDescription>Vercel Blob is not connected yet, so original files are not stored. Add BLOB_READ_WRITE_TOKEN to keep downloadable copies.</AlertDescription></Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import attendance file</CardTitle>
          <CardDescription>Columns: First Name, Last Name, Phone number, Email, Team, Status, Person Responsible, Gender, then one TRUE/FALSE column per Sunday (dd-Mon-yy).</CardDescription>
        </CardHeader>
        <CardContent><AttendanceImport /></CardContent>
      </Card>
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
                    <TableCell><Badge variant={u.status === "completed" ? "secondary" : "outline"}>{u.status}</Badge></TableCell>
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
