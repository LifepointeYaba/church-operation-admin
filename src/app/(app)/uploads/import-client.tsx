"use client"

import { useEffect, useState } from "react"
import { Check, CopyX, LoaderCircle, TriangleAlert, Upload } from "lucide-react"
import { toast } from "@/components/notifications"
import { useActionMutation } from "@/hooks/use-action-mutation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { commitAttendanceImport, previewAttendanceImport } from "./actions"

type Preview = Extract<Awaited<ReturnType<typeof previewAttendanceImport>>, { ok: true }>
type Done = Extract<Awaited<ReturnType<typeof commitAttendanceImport>>, { ok: true }>
type Duplicate = Preview["duplicate"]

const STEPS = {
  preview: ["Uploading file", "Reading rows and columns", "Checking for previous uploads", "Matching people to members"],
  import: ["Uploading file", "Checking for previous uploads", "Saving a copy of the file", "Matching and saving people", "Recording attendance", "Updating member records"],
} as const
const STEP_MS = { preview: 1200, import: 2500 }
const SLOW_AFTER_S = { preview: 20, import: 45 }

function formatDate(iso: string) {
  return new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso).toLocaleDateString("en-GB", { timeZone: "Africa/Lagos", dateStyle: "medium" })
}

export function AttendanceImport() {
  const [file, setFile] = useState<File | null>(null)
  const [sundayDate, setSundayDate] = useState("")
  const [preview, setPreview] = useState<Preview | null>(null)
  const [done, setDone] = useState<Done | null>(null)
  const [createNoPhone, setCreateNoPhone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [blockedDuplicate, setBlockedDuplicate] = useState<Duplicate | null>(null)
  const [allowDuplicate, setAllowDuplicate] = useState(false)
  const fd = () => {
    const f = new FormData()
    f.set("file", file!)
    f.set("sundayDate", sundayDate)
    return f
  }

  function reset() {
    setPreview(null)
    setDone(null)
    setError(null)
    setBlockedDuplicate(null)
    setAllowDuplicate(false)
  }

  // Preview (read the file) and import both go through React Query mutations.
  const previewMutation = useActionMutation((form: FormData) => previewAttendanceImport(form), {
    refresh: false,
    onSuccess: (result) => {
      setPreview(result)
      if (result.duplicate.blocked) toast.warning("This upload looks like a duplicate", { description: "Check the notice below before importing." })
      else toast.info("Preview ready", { description: "Check the numbers, then press Import." })
    },
    onFailure: (r) => { setError(r.error) },
  })
  const importMutation = useActionMutation(
    (v: { form: FormData; createNoPhone: boolean; allowDuplicate: boolean }) => commitAttendanceImport(v.form, v.createNoPhone, v.allowDuplicate),
    {
      success: (r) => ({ title: "Import finished", description: `${r.attendanceAdded} present marks added, ${r.membersAdded} new people.` }),
      onSuccess: (result) => { setDone(result); setPreview(null); setAllowDuplicate(false) },
      onFailure: (r) => {
        if ("duplicate" in r && r.duplicate) setBlockedDuplicate(r.duplicate as Duplicate)
        else setError(r.error)
      },
    },
  )
  const operation: "preview" | "import" | null = previewMutation.isPending ? "preview" : importMutation.isPending ? "import" : null
  const busy = operation !== null

  function previewFile() {
    setError(null)
    previewMutation.mutate(fd())
  }

  function importFile() {
    setError(null)
    importMutation.mutate({ form: fd(), createNoPhone, allowDuplicate })
  }

  return (
    <div className="stagger space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input type="file" accept=".csv,.xlsx,.xls" disabled={busy} onChange={(e) => { setFile(e.target.files?.[0] ?? null); reset() }} />
        <Button variant="secondary" disabled={!file || busy} onClick={previewFile}>
          {operation === "preview" ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {operation === "preview" ? "Reading file…" : "Preview"}
        </Button>
      </div>
      <div className="max-w-xs space-y-1">
        <label htmlFor="weekly-sunday-date" className="text-sm font-medium">Sunday date for weekly files</label>
        <Input id="weekly-sunday-date" type="date" value={sundayDate} disabled={busy} onChange={(e) => { setSundayDate(e.target.value); reset() }} />
      </div>
      {operation && <ImportProgress operation={operation} file={file} />}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            <p className="font-medium">The file could not be processed</p>
            <p>{error}</p>
            <p>Check that the file is valid and your connection is working, then try Preview or select the file again.</p>
          </AlertDescription>
        </Alert>
      )}
      {blockedDuplicate && !preview && <DuplicateNotice duplicate={blockedDuplicate} />}
      {preview && (
        <div className="space-y-3 rounded-lg border p-4 text-sm">
          {preview.duplicate.blocked
            ? <DuplicateNotice duplicate={preview.duplicate} />
            : preview.duplicate.alreadyRecorded.length > 0 && (
              <Alert>
                <AlertDescription>
                  <p className="font-medium">Some Sundays in this file were uploaded before</p>
                  <p>{preview.duplicate.alreadyRecorded.map(formatDate).join(", ")} already have attendance. Those Sundays will be merged, not duplicated; only the new Sundays add fresh records.</p>
                </AlertDescription>
              </Alert>
            )}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="People in file" v={preview.people} />
            <Stat label="Already registered" v={preview.matched} />
            <Stat label="New people" v={preview.added} />
            <Stat label="Need approval" v={preview.pendingApproval.length} />
            <Stat label="Need match review" v={preview.needsConfirm.length} />
            <Stat label="Need fixing" v={preview.flagged} />
            <Stat label="Sundays" v={preview.sundays} />
            <Stat label="New Sundays" v={preview.newSundays} />
            <Stat label="Present marks" v={preview.marks} />
          </div>
          {preview.pendingApproval.length > 0 && (
            <Alert>
              <AlertDescription>
                <p className="font-medium">Unmatched existing attendees will wait for approval after import</p>
                <ul className="list-disc pl-4">
                  {preview.pendingApproval.map((person) => <li key={person.row}>{person.name} (row {person.row})</li>)}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          {preview.needsConfirm.length > 0 && (
            <Alert>
              <AlertDescription>
                <p className="font-medium">Some contact details match multiple registered people</p>
                <ul className="list-disc pl-4">
                  {preview.needsConfirm.map((person) => <li key={person.row}>{person.name} (row {person.row})</li>)}
                </ul>
              </AlertDescription>
            </Alert>
          )}
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
          {preview.duplicate.blocked && (
            <label className="flex items-center gap-2 font-medium text-destructive">
              <Checkbox checked={allowDuplicate} onCheckedChange={(c) => setAllowDuplicate(!!c)} />
              I understand this was uploaded before and want to import it again anyway (for corrections)
            </label>
          )}
          <Button disabled={busy || (preview.duplicate.blocked && !allowDuplicate)} onClick={importFile}>
            {operation === "import" && <LoaderCircle className="size-4 animate-spin" />}
            {operation === "import" ? "Importing…" : "Import"}
          </Button>
        </div>
      )}
      {done && (
        <Alert>
          <AlertDescription>
            <p>Added {done.membersAdded} people, updated {done.membersUpdated}, moved {done.membersPromoted} up a stage (First Timer → Second Timer → Regular), added {done.servicesAdded} Sundays and {done.attendanceAdded} present marks. {done.rejected.length} rejected.</p>
            {done.headcount.created.length + done.headcount.refreshed.length > 0 && (
              <p className="mt-1">Weekly headcount filled from this upload for {[...done.headcount.created, ...done.headcount.refreshed].map(formatDate).join(", ")}. Add children and guests/pastors on <a className="underline" href={`/headcount?date=${done.headcount.created.at(-1) ?? done.headcount.refreshed.at(-1)}`}>Weekly headcount</a>.</p>
            )}
            {done.headcount.kept.length > 0 && (
              <p className="mt-1">Headcount already entered by hand for {done.headcount.kept.map(formatDate).join(", ")}, so it was left as is. Use “Fill from register” there to update it.</p>
            )}
            {done.membersNeedingConfirm.length > 0 && (
              <p className="mt-1">Not imported — these names match several phoneless records, so please confirm by hand: {done.membersNeedingConfirm.map((m) => `${m.name} (row ${m.row})`).join(", ")}.</p>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

function ImportProgress({ operation, file }: { operation: "preview" | "import"; file: File | null }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const started = Date.now()
    const id = setInterval(() => setElapsed(Date.now() - started), 250)
    return () => clearInterval(id)
  }, [operation])
  const steps = STEPS[operation]
  // Steps advance on a timer because the server works in one request; the last step holds until it replies.
  const active = Math.min(Math.floor(elapsed / STEP_MS[operation]), steps.length - 1)
  const seconds = Math.floor(elapsed / 1000)
  const slow = seconds >= SLOW_AFTER_S[operation]
  const percent = Math.min(95, Math.round((1 - Math.exp(-elapsed / (STEP_MS[operation] * steps.length))) * 100))

  return (
    <div role="status" aria-live="polite" className="animate-fade-up space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center gap-3">
        <span className="relative flex size-5 shrink-0 items-center justify-center">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/30" />
          <LoaderCircle className="relative size-5 animate-spin text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{operation === "import" ? "Import in progress" : "Preparing preview"}</p>
          <p className="truncate text-sm text-muted-foreground">{steps[active]}…</p>
        </div>
        <span className="text-sm tabular-nums text-muted-foreground">{seconds}s</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-primary/15">
        <div className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out" style={{ width: `${percent}%` }} />
      </div>
      <ol className="grid gap-1.5 text-sm sm:grid-cols-2">
        {steps.map((step, i) => (
          <li key={step} className={`flex items-center gap-2 transition-colors ${i > active ? "text-muted-foreground/60" : i === active ? "font-medium" : "text-muted-foreground"}`}>
            {i < active
              ? <Check className="size-4 shrink-0 text-primary" />
              : i === active
                ? <LoaderCircle className="size-4 shrink-0 animate-spin text-primary" />
                : <span className="mx-1 size-2 shrink-0 rounded-full bg-muted-foreground/30" />}
            {step}
          </li>
        ))}
      </ol>
      {file && <p className="text-xs text-muted-foreground">{file.name} · {(file.size / 1024).toFixed(0)} KB</p>}
      {slow ? (
        <p className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          This is taking longer than usual. Large files or a slow connection can cause this — keep this page open. If nothing happens after a few minutes, check the upload history below before trying again.
        </p>
      ) : operation === "import" && (
        <p className="text-xs text-muted-foreground">Please keep this page open until the import finishes.</p>
      )}
    </div>
  )
}

function DuplicateNotice({ duplicate }: { duplicate: Duplicate }) {
  return (
    <Alert variant="destructive">
      <CopyX className="size-4" />
      <AlertDescription>
        <p className="font-medium">This attendance has already been uploaded</p>
        {duplicate.sameFile && (
          <p>This exact file was imported as “{duplicate.sameFile.fileName}” on {formatDate(duplicate.sameFile.uploadedAt)}.</p>
        )}
        {duplicate.allWeeksRecorded && (
          <p>Attendance already exists for {duplicate.alreadyRecorded.map(formatDate).join(", ")}.</p>
        )}
        <p>Importing again is blocked to avoid re-uploading the same week. Check the Sunday date and file, or see the upload history below.</p>
      </AlertDescription>
    </Alert>
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
