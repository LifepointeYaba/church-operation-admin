"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { commitAttendanceImport, previewAttendanceImport } from "./actions"

type Preview = Extract<Awaited<ReturnType<typeof previewAttendanceImport>>, { ok: true }>
type Done = Extract<Awaited<ReturnType<typeof commitAttendanceImport>>, { ok: true }>

export function AttendanceImport() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [done, setDone] = useState<Done | null>(null)
  const [createNoPhone, setCreateNoPhone] = useState(false)
  const [pending, start] = useTransition()
  const fd = () => {
    const f = new FormData()
    f.set("file", file!)
    return f
  }
  return (
    <div className="stagger space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); setDone(null) }} />
        <Button variant="secondary" disabled={!file || pending} onClick={() => start(async () => {
          const r = await previewAttendanceImport(fd())
          if (!r.ok) { toast.error(r.error); return }
          setPreview(r)
        })}><Upload className="size-4" /> Preview</Button>
      </div>
      {preview && (
        <div className="space-y-3 rounded-lg border p-4 text-sm">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="People in file" v={preview.people} />
            <Stat label="Already registered" v={preview.matched} />
            <Stat label="New people" v={preview.added} />
            <Stat label="Need fixing" v={preview.flagged} />
            <Stat label="Sundays" v={preview.sundays} />
            <Stat label="New Sundays" v={preview.newSundays} />
            <Stat label="Present marks" v={preview.marks} />
          </div>
          {[...preview.rejectedColumns.map((c) => `Column “${c.header}”: ${c.reason}`), ...preview.rejectedRows.map((r) => `Row ${r.row}: ${r.reason}`)].length > 0 && (
            <Alert>
              <AlertDescription>
                <p className="font-medium">Rejected</p>
                <ul className="list-disc pl-4">
                  {preview.rejectedColumns.map((c) => <li key={c.header}>Column “{c.header}”: {c.reason}</li>)}
                  {preview.rejectedRows.map((r) => <li key={r.row}>Row {r.row}: {r.reason}</li>)}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          <label className="flex items-center gap-2">
            <Checkbox checked={createNoPhone} onCheckedChange={(c) => setCreateNoPhone(!!c)} />
            Create new records for people without a phone whose name matches more than one existing record
          </label>
          <Button disabled={pending} onClick={() => start(async () => {
            const r = await commitAttendanceImport(fd(), createNoPhone)
            if (!r.ok) { toast.error(r.error); return }
            setDone(r)
            setPreview(null)
            toast.success("Import finished")
            router.refresh()
          })}>{pending ? "Importing…" : "Import"}</Button>
        </div>
      )}
      {done && (
        <Alert>
          <AlertDescription>
            <p>Added {done.membersAdded} people, updated {done.membersUpdated}, added {done.servicesAdded} Sundays and {done.attendanceAdded} present marks. {done.rejected.length} rejected.</p>
            {done.membersNeedingConfirm.length > 0 && (
              <p className="mt-1">Not imported — these names match several phoneless records, so please confirm by hand: {done.membersNeedingConfirm.map((m) => `${m.name} (row ${m.row})`).join(", ")}.</p>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

function Stat({ label, v }: { label: string; v: number }) {
  return (
    <div className="rounded-md bg-muted/60 p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{v.toLocaleString()}</div>
    </div>
  )
}
