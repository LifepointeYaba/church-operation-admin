"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { TriangleAlert, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { NativeSelect } from "@/components/native-select"
import { formatDate } from "@/lib/dates"
import type { HeadcountValues } from "@/lib/import/headcount"
import { addNoteAction, commitHeadcountUpload, deleteNoteAction, previewHeadcountUpload, saveHeadcountAction } from "./actions"

const FIELDS = [
  ["workers", "Workers"], ["members", "Members"], ["firstTimers", "First timers"], ["secondTimers", "Second timers"],
  ["male", "Male"], ["female", "Female"], ["children", "Children"],
] as const

export function HeadcountForm({ date, dates, existing, registered }: { date: string; dates: string[]; existing: HeadcountValues | null; registered: number }) {
  const router = useRouter()
  const blank = { workers: "", members: "", firstTimers: "", secondTimers: "", male: "", female: "", children: "" }
  const [v, setV] = useState<Record<string, string>>(existing ? Object.fromEntries(FIELDS.map(([k]) => [k, String(existing[k])])) : blank)
  const [notes, setNotes] = useState("")
  const [confirmReplace, setConfirmReplace] = useState(false)
  const [pending, start] = useTransition()
  const n = (k: string) => (v[k] === "" ? 0 : Number(v[k]))
  const total = n("workers") + n("members") + n("firstTimers") + n("secondTimers")
  const byGender = n("male") + n("female") + n("children")
  const filled = FIELDS.every(([k]) => v[k] !== "")

  const save = (replace: boolean) =>
    start(async () => {
      const values = Object.fromEntries(FIELDS.map(([k]) => [k, n(k)])) as unknown as HeadcountValues
      const r = await saveHeadcountAction(date, { ...values, total }, notes, replace)
      if (!r.ok) {
        if ("exists" in r && r.exists) { setConfirmReplace(true); return }
        { toast.error(r.error); return }
      }
      setConfirmReplace(false)
      setNotes("")
      toast.success(r.replaced ? "Headcount replaced (old version kept)" : "Headcount saved", { description: r.warnings.join(" ") || undefined })
      router.refresh()
    })

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(false) }}>
      <div className="space-y-1.5">
        <Label htmlFor="hc-date">Sunday</Label>
        <NativeSelect id="hc-date" value={date} onChange={(e) => router.push(`/headcount?date=${e.target.value}`)} className="h-11 w-full text-base">
          {dates.map((d) => <option key={d} value={d}>{formatDate(d, "long")}</option>)}
        </NativeSelect>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {FIELDS.map(([k, label]) => (
          <div key={k} className="space-y-1.5">
            <Label htmlFor={`hc-${k}`}>{label}</Label>
            <Input id={`hc-${k}`} inputMode="numeric" pattern="[0-9]*" className="h-11 text-base tabular-nums" value={v[k]}
              onChange={(e) => setV({ ...v, [k]: e.target.value.replace(/\D/g, "") })} required />
          </div>
        ))}
        <div className="space-y-1.5">
          <Label>Total</Label>
          <div className="flex h-11 items-center rounded-md border bg-muted px-3 text-lg font-semibold tabular-nums" aria-live="polite">{total}</div>
        </div>
      </div>
      {filled && byGender !== total && (
        <Alert><TriangleAlert className="size-4" /><AlertDescription>Male + Female + Children = {byGender}, but Total is {total}. You can still save.</AlertDescription></Alert>
      )}
      <p className="text-xs text-muted-foreground">{registered} people are marked present on this Sunday (children and unregistered visitors are counted only here).</p>
      <div className="space-y-1.5">
        <Label htmlFor="hc-notes">Notes (one per line — streaks, returnees, converts)</Label>
        <Textarea id="hc-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {confirmReplace ? (
        <Alert>
          <AlertDescription>
            <p>This Sunday already has a headcount. Replace it? The old version is kept.</p>
            <div className="mt-2 flex gap-2">
              <Button type="button" disabled={pending} onClick={() => save(true)}>Replace</Button>
              <Button type="button" variant="outline" onClick={() => setConfirmReplace(false)}>Cancel</Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : (
        <Button className="h-11 w-full" disabled={pending || !filled}>{pending ? "Saving…" : existing ? "Save changes" : "Save headcount"}</Button>
      )}
    </form>
  )
}

type Preview = Extract<Awaited<ReturnType<typeof previewHeadcountUpload>>, { ok: true }>

export function HeadcountUpload() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [replace, setReplace] = useState<Record<string, boolean>>({})
  const [pending, start] = useTransition()
  const fd = () => {
    const f = new FormData()
    f.set("file", file!)
    return f
  }
  const counts = useMemo(() => {
    if (!preview) return null
    return {
      ok: preview.rows.filter((r) => !r.errors.length).length,
      bad: preview.rows.filter((r) => r.errors.length).length,
      existing: preview.rows.filter((r) => r.existing != null && !r.errors.length).length,
    }
  }, [preview])

  return (
    <div className="stagger space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null) }} />
        <Button variant="secondary" disabled={!file || pending} onClick={() => start(async () => {
          const r = await previewHeadcountUpload(fd())
          if (!r.ok) { toast.error(r.error); return }
          setPreview(r)
          setReplace({})
        })}><Upload className="size-4" /> Preview</Button>
      </div>
      {preview && counts && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="secondary">{counts.ok} ready</Badge>
            {counts.bad > 0 && <Badge variant="destructive">{counts.bad} with errors (skipped)</Badge>}
            {counts.existing > 0 && <Badge variant="outline">{counts.existing} already have a headcount</Badge>}
            <Badge variant="outline">{preview.notes} notes</Badge>
          </div>
          {preview.skippedBlocks.map((b) => (
            <Alert key={b.title}><TriangleAlert className="size-4" /><AlertDescription><b>Skipped “{b.title}”:</b> {b.reason}</AlertDescription></Alert>
          ))}
          <div className="max-h-96 overflow-auto rounded-xl border bg-card">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead>Sunday</TableHead><TableHead className="text-right">W</TableHead><TableHead className="text-right">M</TableHead>
                  <TableHead className="text-right">1st</TableHead><TableHead className="text-right">2nd</TableHead><TableHead className="text-right">Total</TableHead>
                  <TableHead>Checks</TableHead><TableHead>Replace?</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.rows.map((r) => (
                  <TableRow key={r.date} className={r.errors.length ? "opacity-60" : ""}>
                    <TableCell className="whitespace-nowrap">{/^\d{4}-\d{2}-\d{2}$/.test(r.date) ? formatDate(r.date, "long") : r.date}</TableCell>
                    {[r.workers, r.members, r.firstTimers, r.secondTimers, r.total].map((x, i) => <TableCell key={i} className="text-right tabular-nums">{Number.isNaN(x) ? "?" : x}</TableCell>)}
                    <TableCell className="text-xs">
                      {r.errors.map((e) => <div key={e} className="text-destructive">{e}</div>)}
                      {r.warnings.map((w) => <div key={w} className="text-status-warn">{w}</div>)}
                      {!r.errors.length && !r.warnings.length && <span className="text-status-good">OK</span>}
                    </TableCell>
                    <TableCell>
                      {r.existing != null && !r.errors.length ? (
                        <label className="flex items-center gap-2 text-xs">
                          <Checkbox checked={!!replace[r.date]} onCheckedChange={(c) => setReplace({ ...replace, [r.date]: !!c })} />
                          Replace (now {r.existing})
                        </label>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex gap-2">
            <Button disabled={pending || counts.ok === 0} onClick={() => start(async () => {
              const r = await commitHeadcountUpload(fd(), Object.keys(replace).filter((k) => replace[k]))
              if (!r.ok) { toast.error(r.error); return }
              toast.success(`Saved ${r.saved} Sundays`, { description: `${r.replaced} replaced · ${r.skippedExisting.length} kept as they were · ${r.failed} failed · ${r.notesAdded} notes` })
              setPreview(null)
              setFile(null)
              router.refresh()
            })}>Save {counts.ok - counts.existing + Object.values(replace).filter(Boolean).length} Sundays</Button>
            <Button variant="outline" onClick={() => setPreview(null)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  )
}

const NOTE_LABEL: Record<string, string> = { streak: "Streak", returnee: "Returnee", convert: "Convert", general: "Note" }

export function NotesList({ date, notes }: { date: string; notes: { id: number; type: string; text: string }[] }) {
  const router = useRouter()
  const [text, setText] = useState("")
  const [pending, start] = useTransition()
  return (
    <div className="space-y-2">
      {notes.length === 0 && <p className="text-sm text-muted-foreground">No notes for this Sunday.</p>}
      <ul className="space-y-1 text-sm">
        {notes.map((n) => (
          <li key={n.id} className="flex items-start justify-between gap-2">
            <span><Badge variant="outline" className="mr-1.5 text-[11px]">{NOTE_LABEL[n.type]}</Badge>{n.text}</span>
            <button aria-label="Delete note" className="text-muted-foreground hover:text-destructive" onClick={() => start(async () => { await deleteNoteAction(n.id); router.refresh() })}>
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => {
        const r = await addNoteAction(date, text)
        if (!r.ok) { toast.error(r.error); return }
        setText("")
        router.refresh()
      }) }}>
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a note…" />
        <Button variant="secondary" disabled={pending || !text.trim()}>Add</Button>
      </form>
    </div>
  )
}
