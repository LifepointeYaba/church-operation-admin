"use client"

import { useState } from "react"
import { RefreshCw, TriangleAlert, Trash2 } from "lucide-react"
import { useActionMutation } from "@/hooks/use-action-mutation"
import { useNavigation } from "@/components/navigation"
import { useConfirm } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { SelectField } from "@/components/select-field"
import { formatDate } from "@/lib/dates"
import type { HeadcountValues } from "@/lib/import/headcount"
import { addNoteAction, deleteNoteAction, saveHeadcountAction } from "./actions"

const FIELDS = [
  ["workers", "Workers"], ["members", "Members"], ["firstTimers", "First timers"], ["secondTimers", "Second timers"],
  ["male", "Male"], ["female", "Female"], ["children", "Children"], ["guests", "Guests & pastors"],
] as const
/** Added by hand on top of the register; left blank means 0. */
const HAND_KEYS = ["children", "guests"] as const

const REGISTER_KEYS = ["workers", "members", "firstTimers", "secondTimers", "male", "female"] as const
export type RegisterNumbers = Record<(typeof REGISTER_KEYS)[number], number>
export type HeadcountSource = "upload" | "manual" | "chart"

const SOURCE_TEXT: Record<HeadcountSource, string> = {
  upload: "Filled automatically from the attendance upload. Add children and guests/pastors; they stay when the next upload refreshes the rest.",
  manual: "Entered by hand. Later uploads won’t change it; use “Fill from register” to pull in the latest upload numbers.",
  chart: "From the Chart sheet. Use “Fill from register” to replace with numbers from the attendance upload.",
}

export function HeadcountForm({ date, dates, existing, registered, register, source }: {
  date: string; dates: string[]; existing: HeadcountValues | null; registered: number
  register: RegisterNumbers | null; source: HeadcountSource | null
}) {
  const blank = { workers: "", members: "", firstTimers: "", secondTimers: "", male: "", female: "", children: "", guests: "" }
  // No headcount yet: start from the attendance register so only children and guests need typing.
  const initial = existing
    ? Object.fromEntries(FIELDS.map(([k]) => [k, String(existing[k])]))
    : register ? { ...blank, ...Object.fromEntries(REGISTER_KEYS.map((k) => [k, String(register[k])])) } : blank
  const [v, setV] = useState<Record<string, string>>(initial)
  const fillFromRegister = () => register && setV({ ...v, ...Object.fromEntries(REGISTER_KEYS.map((k) => [k, String(register[k])])) })
  const [notes, setNotes] = useState("")
  const [confirmReplace, setConfirmReplace] = useState(false)
  const nav = useNavigation()
  const n = (k: string) => (v[k] === "" ? 0 : Number(v[k]))
  const registerSum = n("workers") + n("members") + n("firstTimers") + n("secondTimers")
  const total = registerSum + n("children") + n("guests")
  const byGender = n("male") + n("female") + n("children") + n("guests")
  const filled = FIELDS.every(([k]) => v[k] !== "" || (HAND_KEYS as readonly string[]).includes(k))

  const mutation = useActionMutation(
    (replace: boolean) => {
      const values = Object.fromEntries(FIELDS.map(([k]) => [k, n(k)])) as unknown as HeadcountValues
      return saveHeadcountAction(date, { ...values, total }, notes, replace)
    },
    {
      success: (r) => ({ title: r.replaced ? "Headcount updated (old version kept)" : `Headcount saved for ${formatDate(date, "long")}`, description: r.warnings.join(" ") || undefined }),
      onSuccess: () => { setConfirmReplace(false); setNotes("") },
      // Already has a headcount → ask to replace instead of showing an error.
      onFailure: (r) => { if ("exists" in r && r.exists) { setConfirmReplace(true); return true } },
    },
  )
  const pending = mutation.isPending
  const save = (replace: boolean) => mutation.mutate(replace)

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(false) }}>
      <div className="space-y-1.5">
        <Label htmlFor="hc-date">Sunday</Label>
        <SelectField id="hc-date" value={date} onChange={(e) => nav.push(`/headcount?date=${e.target.value}`)} className="h-11 w-full text-base">
          {dates.map((d) => <option key={d} value={d}>{formatDate(d, "long")}</option>)}
        </SelectField>
      </div>
      {(source || register) && (
        <div className="flex flex-wrap items-start justify-between gap-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
          <p className="min-w-0 flex-1">
            {source ? SOURCE_TEXT[source] : "No headcount saved yet. Numbers below come from the attendance upload; add children and save."}
          </p>
          {register && source !== "upload" && existing && (
            <Button type="button" size="sm" variant="outline" onClick={fillFromRegister}><RefreshCw className="size-3.5" /> Fill from register</Button>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {FIELDS.map(([k, label]) => (
          <div key={k} className="space-y-1.5">
            <Label htmlFor={`hc-${k}`}>{label}</Label>
            <Input id={`hc-${k}`} inputMode="numeric" pattern="[0-9]*" className="h-11 text-base tabular-nums" value={v[k]}
              placeholder={(HAND_KEYS as readonly string[]).includes(k) ? "0" : undefined}
              onChange={(e) => setV({ ...v, [k]: e.target.value.replace(/\D/g, "") })} required={!(HAND_KEYS as readonly string[]).includes(k)} />
          </div>
        ))}
        <div className="space-y-1.5">
          <Label>Total (everyone)</Label>
          <div className="flex h-11 items-center rounded-md border bg-muted px-3 text-lg font-semibold tabular-nums" aria-live="polite">{total}</div>
        </div>
      </div>
      {filled && byGender !== total && (
        <Alert><TriangleAlert className="size-4" /><AlertDescription>Male + Female + Children + Guests = {byGender}, but Total is {total}. You can still save.</AlertDescription></Alert>
      )}
      <p className="text-xs text-muted-foreground">
        {registered} marked present in the register + {n("children")} children + {n("guests")} guests &amp; pastors = <span className="font-semibold text-foreground">{total}</span>. This total is shown everywhere as present.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="hc-notes">Notes (one per line — streaks, returnees, converts)</Label>
        <Textarea id="hc-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {confirmReplace ? (
        <Alert>
          <AlertDescription>
            <p>This Sunday already has a headcount. Replace it? The old version is kept.</p>
            <div className="mt-2 flex gap-2">
              <Button type="button" loading={pending} onClick={() => save(true)}>Replace</Button>
              <Button type="button" variant="outline" onClick={() => setConfirmReplace(false)}>Cancel</Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : (
        <Button className="h-11 w-full" loading={pending} disabled={!filled}>{pending ? "Saving…" : existing ? "Save changes" : "Save headcount"}</Button>
      )}
    </form>
  )
}

const NOTE_LABEL: Record<string, string> = { streak: "Streak", returnee: "Returnee", convert: "Convert", general: "Note" }

export function NotesList({ date, notes }: { date: string; notes: { id: number; type: string; text: string }[] }) {
  const [text, setText] = useState("")
  const confirm = useConfirm()
  const add = useActionMutation((t: string) => addNoteAction(date, t), { success: "Note added", onSuccess: () => setText("") })
  const remove = useActionMutation((id: number) => deleteNoteAction(id), { success: "Note deleted" })
  return (
    <div className="space-y-2">
      {notes.length === 0 && <p className="text-sm text-muted-foreground">No notes for this Sunday.</p>}
      <ul className="space-y-1 text-sm">
        {notes.map((n) => (
          <li key={n.id} className="flex items-start justify-between gap-2">
            <span><Badge variant="outline" className="mr-1.5 text-[11px]">{NOTE_LABEL[n.type]}</Badge>{n.text}</span>
            <Button size="icon" variant="ghost" aria-label="Delete note" className="size-7 text-muted-foreground hover:text-destructive"
              loading={remove.isPending && remove.variables === n.id}
              onClick={async () => { if (await confirm({ title: "Delete this note?", description: n.text, confirmLabel: "Delete", destructive: true })) remove.mutate(n.id) }}>
              {!(remove.isPending && remove.variables === n.id) && <Trash2 className="size-4" />}
            </Button>
          </li>
        ))}
      </ul>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); add.mutate(text) }}>
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a note…" aria-label="New note" />
        <Button variant="secondary" loading={add.isPending} disabled={!text.trim()}>Add</Button>
      </form>
    </div>
  )
}
