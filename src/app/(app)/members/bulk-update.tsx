"use client"

import { useState } from "react"
import Link from "next/link"
import { Download, Upload } from "lucide-react"
import { useActionMutation } from "@/hooks/use-action-mutation"
import { useConfirm } from "@/components/confirm-dialog"
import { useCan } from "@/components/permissions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { applyMemberUpdatesAction, previewMemberUpdatesAction } from "./actions"

type Preview = Extract<Awaited<ReturnType<typeof previewMemberUpdatesAction>>, { ok: true }>

const show = (v: string | null) => (v ? v : <span className="italic text-muted-foreground">blank</span>)

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{n}</span>
      <div className="space-y-0.5">
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground">{children}</p>
      </div>
    </li>
  )
}

const columnGuide = (statuses: string[]): [string, React.ReactNode][] => [
  ["ID", "Leave as it is. It identifies the member."],
  ["First Name / Last Name", "The person’s name, e.g. Ada / Obi."],
  ["Phone / Alt Phone", "An 11-digit Nigerian number, e.g. 0803 123 4567 or +234 803 123 4567."],
  ["Email", "e.g. ada@example.com"],
  ["Address", "Any text."],
  ["Gender", "Male or Female (M or F is fine)."],
  ["Status", <>One of: {statuses.map((s, i) => <span key={s}>{i > 0 && " · "}<span className="text-foreground">{s}</span></span>)}</>],
  ["Branch", "e.g. Main"],
  ["Teams", <>Every team they’re in, separated by commas, e.g. <span className="text-foreground">Choir, Ushering</span>. This replaces their current teams. Type <span className="text-foreground">No team</span> to remove all teams. New team names are created automatically.</>],
  ["Person Responsible", "Who follows this person up, e.g. Pastor Tunde."],
  ["Notes", "Any text. This replaces the existing notes."],
]

/** Members → "Update from file": upload an edited export to change many members at once. */
export function BulkUpdateButton({ statuses }: { statuses: string[] }) {
  const can = useCan()
  const confirm = useConfirm()
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const form = () => {
    const f = new FormData()
    f.set("file", file!)
    return f
  }
  const reset = () => { setPreview(null); setError(null) }

  const previewMutation = useActionMutation(() => previewMemberUpdatesAction(form()), {
    refresh: false,
    onSuccess: (r) => setPreview(r),
    onFailure: (r) => { setError(r.error); return true },
  })
  const apply = useActionMutation(() => applyMemberUpdatesAction(form()), {
    success: (r) => ({
      title: `Updated ${r.updated} ${r.updated === 1 ? "member" : "members"}`,
      description: r.skipped ? `${r.skipped} rows skipped because of problems.` : undefined,
    }),
    onSuccess: () => { setOpen(false); setFile(null); reset() },
  })

  if (!can("members.edit")) return null
  const busy = previewMutation.isPending || apply.isPending
  const n = preview?.updates.length ?? 0

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) setOpen(o) }}>
      <DialogTrigger asChild><Button variant="outline"><Upload className="size-4" /> Update from file</Button></DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Update members from a file</DialogTitle>
          <DialogDescription>
            Change many members at once. Nothing is saved until you check the preview and press Save.
          </DialogDescription>
        </DialogHeader>

        <details open={!preview} className="group rounded-lg border bg-muted/30 text-sm">
          <summary className="cursor-pointer select-none px-3 py-2 font-medium">How to update members from a file</summary>
          <div className="space-y-4 border-t px-3 py-3">
            <ol className="space-y-3">
              <Step n={1} title="Download the members list">
                {can("members.export")
                  ? <><a href="/api/export/members" className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-4"><Download className="size-3.5" />Download the members list (CSV)</a>. It has every member with their ID and current details. You can also filter the Members table first and use <b className="text-foreground">Export CSV</b> to download just those people.</>
                  : <>Ask an admin for the members list (CSV), or use your own sheet with an <b className="text-foreground">ID</b> or <b className="text-foreground">Phone</b> column.</>}
              </Step>
              <Step n={2} title="Make your changes">
                Open it in Excel or Google Sheets and type the new values. <b className="text-foreground">Don’t change the ID column</b>: it tells the app which member each row belongs to.
                You can delete rows for people you aren’t changing, and columns you aren’t using.
              </Step>
              <Step n={3} title="Save it as CSV or Excel">
                In Excel: File → Save As → <b className="text-foreground">CSV UTF-8</b> or .xlsx. In Google Sheets: File → Download → CSV.
              </Step>
              <Step n={4} title="Upload and preview">
                Choose the file below and press <b className="text-foreground">Preview changes</b>. You’ll see every change as old → new, and any rows that will be skipped with the reason. Nothing is saved yet.
              </Step>
              <Step n={5} title="Save">
                If the preview looks right, press <b className="text-foreground">Save</b>. Each change appears in the member’s change history, where you can undo it with <b className="text-foreground">Revert</b>.
              </Step>
            </ol>

            <div className="space-y-1.5">
              <h3 className="font-medium">Good to know</h3>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                <li><b className="text-foreground">A blank cell changes nothing.</b> You can’t accidentally erase details by leaving a cell empty.</li>
                <li>This only updates people who are already in the system. To add new people, use <b className="text-foreground">Add member</b> or Uploads &amp; import.</li>
                <li>No ID column? Rows are matched by phone number instead. If several people share a phone, add the ID column.</li>
                <li>Activity, Visits, Streak, Last Attended, First Seen and Flags come from attendance and are ignored.</li>
              </ul>
            </div>

            <div className="space-y-1.5">
              <h3 className="font-medium">What to type in each column</h3>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/60 text-muted-foreground">
                    <tr><th className="px-2 py-1.5 font-medium">Column</th><th className="px-2 py-1.5 font-medium">What to enter</th></tr>
                  </thead>
                  <tbody className="divide-y align-top">
                    {columnGuide(statuses).map(([col, help]) => (
                      <tr key={col}><td className="whitespace-nowrap px-2 py-1.5 font-medium">{col}</td><td className="px-2 py-1.5 text-muted-foreground">{help}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </details>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Input type="file" accept=".csv,.xlsx,.xls" aria-label="Members file" disabled={busy}
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); reset() }} />
          <Button variant="secondary" disabled={!file || busy} loading={previewMutation.isPending} onClick={() => previewMutation.mutate(undefined)}>
            Preview changes
          </Button>
        </div>

        {error && <Alert variant="destructive"><AlertTitle>Couldn’t read the file</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

        {preview && (
          <div className="space-y-4">
            <p className="text-sm">
              <b>{n}</b> {n === 1 ? "member" : "members"} will change · {preview.unchanged} already up to date
              {preview.errors.length > 0 && <> · <span className="text-destructive">{preview.errors.length} rows skipped</span></>}
            </p>
            {preview.ignoredColumns.length > 0 && (
              <p className="text-xs text-muted-foreground">Ignored columns: {preview.ignoredColumns.join(", ")}</p>
            )}

            {preview.errors.length > 0 && (
              <section className="space-y-1">
                <h3 className="text-sm font-semibold">Skipped rows</h3>
                <ul className="max-h-40 overflow-y-auto rounded-md border text-sm">
                  {preview.errors.map((e) => (
                    <li key={e.row} className="flex gap-3 border-b px-3 py-1.5 last:border-0">
                      <span className="w-14 shrink-0 tabular-nums text-muted-foreground">Row {e.row}</span><span>{e.reason}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {n > 0 && (
              <section className="space-y-1">
                <h3 className="text-sm font-semibold">Changes</h3>
                <ul className="max-h-80 divide-y overflow-y-auto rounded-md border text-sm">
                  {preview.updates.map((u) => (
                    <li key={u.memberId} className="space-y-1 px-3 py-2">
                      <div className="flex justify-between gap-2">
                        <Link href={`/members/${u.memberId}`} target="_blank" className="font-medium hover:underline">{u.name}</Link>
                        <span className="text-xs text-muted-foreground">Row {u.row} · #{u.memberId}</span>
                      </div>
                      <ul className="space-y-0.5 text-muted-foreground">
                        {u.changes.map((c) => (
                          <li key={c.field} className="break-words">
                            {c.label}: {show(c.before)} → <span className="text-foreground">{show(c.after)}</span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
              <Button disabled={!n || busy} loading={apply.isPending} onClick={async () => {
                const ok = await confirm({
                  title: `Save changes to ${n} ${n === 1 ? "member" : "members"}?`,
                  description: "Each change is recorded in the member’s change history and can be reverted from their profile.",
                  confirmLabel: "Save changes",
                })
                if (ok) apply.mutate(undefined)
              }}>
                Save {n} {n === 1 ? "change" : "changes"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
