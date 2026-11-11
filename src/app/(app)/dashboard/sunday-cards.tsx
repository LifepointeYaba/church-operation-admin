"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { ChevronDown, ChevronRight, Tag } from "lucide-react"
import { useActionMutation } from "@/hooks/use-action-mutation"
import { useCan } from "@/components/permissions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { StatusBadge } from "@/components/common"
import { displayPhone } from "@/lib/phone"
import { formatDate } from "@/lib/dates"
import { cn } from "@/lib/utils"
import type { PersonGroup, SundayPerson } from "@/lib/sunday-people"
import { setSundayLabelAction, sundayDetailsAction, sundayLabelsAction } from "./actions"

export type SundayCard = { date: string; label: string | null; notes: { text: string }[]; hasService: boolean }

/** Small badge for a Sunday's label. */
export function SundayLabelBadge({ label, className }: { label: string | null; className?: string }) {
  if (!label) return null
  return <Badge className={cn("gap-1 bg-primary/15 text-primary hover:bg-primary/15", className)}><Tag className="size-3" />{label}</Badge>
}

/** One card per Sunday of the month: label + notes. Click to see the people behind the numbers. */
export function SundayCards({ cards, selected }: { cards: SundayCard[]; selected: string }) {
  const [open, setOpen] = useState<SundayCard | null>(null)
  if (!cards.length) return null
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <button
            key={c.date}
            type="button"
            disabled={!c.hasService}
            onClick={() => setOpen(c)}
            className={cn(
              "group rounded-md border p-3 text-left text-sm transition-colors enabled:hover:border-primary/50 enabled:hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              c.date === selected && "border-primary/40 bg-primary/5",
            )}
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="font-medium">{formatDate(c.date, "long")}</span>
              {c.hasService && <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />}
            </div>
            <div className="mb-1">
              {c.label ? <SundayLabelBadge label={c.label} /> : <span className="text-xs text-muted-foreground">Regular Sunday</span>}
            </div>
            {c.notes.length > 0 && (
              <ul className="space-y-0.5 text-muted-foreground">
                {c.notes.map((n, i) => <li key={i} className={cn(n.text.toLowerCase().endsWith("distribution") && "pt-1 font-medium text-foreground first:pt-0")}>{n.text}</li>)}
              </ul>
            )}
            {c.hasService && <p className="mt-2 text-xs font-medium text-primary opacity-80 group-hover:opacity-100">See who came →</p>}
          </button>
        ))}
      </div>
      <SundayDialog card={open} onClose={() => setOpen(null)} />
    </>
  )
}

function PersonRow({ p }: { p: SundayPerson }) {
  return (
    <li>
      <Link href={`/members/${p.id}`} className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-muted">
        <span className="min-w-0">
          <span className="block truncate font-medium">{p.name}</span>
          {p.phone && <span className="text-xs text-muted-foreground tabular-nums">{displayPhone(p.phone)}</span>}
        </span>
        <StatusBadge status={p.status} />
      </Link>
    </li>
  )
}

function Section({ title, hint, count, children }: { title: string; hint?: string; count: number; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="flex items-baseline gap-2 text-sm font-semibold">{title} <span className="font-normal text-muted-foreground">{count}</span></h3>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {count === 0 ? <p className="text-sm text-muted-foreground">Nobody.</p> : children}
    </section>
  )
}

type Note = { id: number; text: string; people: SundayPerson[]; stated: number | null }

/** A note line; when it's about specific people ("1 returned from last week"), click to show them. */
function NoteLine({ note }: { note: Note }) {
  const [open, setOpen] = useState(false)
  const heading = note.text.toLowerCase().endsWith("distribution")
  const linkable = note.stated != null || note.people.length > 0
  if (!linkable) {
    return <li className={cn("px-2 py-1", heading ? "pt-2 font-medium text-foreground" : "text-muted-foreground")}>{note.text}</li>
  }
  const differs = note.stated != null && note.stated !== note.people.length
  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left hover:bg-muted"
      >
        <span className="underline decoration-dotted underline-offset-4">{note.text}</span>
        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
          {note.people.length} {note.people.length === 1 ? "person" : "people"}
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
        </span>
      </button>
      {open && (
        <div className="ml-2 border-l pl-2">
          {differs && (
            <p className="px-2 py-1 text-xs text-amber-600 dark:text-amber-400">
              The note says {note.stated}; the register shows {note.people.length}.
            </p>
          )}
          {note.people.length ? <ul>{note.people.map((p) => <PersonRow key={p.id} p={p} />)}</ul>
            : <p className="px-2 py-1 text-xs text-muted-foreground">No matching second timers in the register.</p>}
        </div>
      )}
    </li>
  )
}

function Groups({ groups }: { groups: PersonGroup[] }) {
  return (
    <div className="space-y-2">
      {groups.map((g) => (
        <div key={g.key}>
          <p className="px-2 text-xs font-medium text-muted-foreground">{g.title} · {g.people.length}</p>
          <ul>{g.people.map((p) => <PersonRow key={p.id} p={p} />)}</ul>
        </div>
      ))}
    </div>
  )
}

function SundayDialog({ card, onClose }: { card: SundayCard | null; onClose: () => void }) {
  const can = useCan()
  const canSeePeople = can("members.view")
  const details = useQuery({
    queryKey: ["sunday-details", card?.date],
    queryFn: () => sundayDetailsAction(card!.date),
    enabled: !!card && canSeePeople,
  })
  const d = details.data
  return (
    <Dialog open={!!card} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Sunday {card && formatDate(card.date, "long")}</DialogTitle>
          <DialogDescription>{d ? `${d.present} marked present in the register.` : "Who was behind this Sunday’s numbers."}</DialogDescription>
        </DialogHeader>
        {card && <LabelEditor key={card.date} date={card.date} label={card.label} />}
        {!canSeePeople ? (
          <p className="text-sm text-muted-foreground">Your role can’t view member records.</p>
        ) : details.isPending ? (
          <div className="space-y-2">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
        ) : !d ? (
          <p className="text-sm text-muted-foreground">No register for this Sunday.</p>
        ) : (
          <div className="space-y-5">
            {d.notes.length > 0 && (
              <section className="space-y-1.5">
                <h3 className="text-sm font-semibold">Notes</h3>
                <p className="text-xs text-muted-foreground">Click a line to see who it’s about.</p>
                <ul className="space-y-0.5 text-sm">
                  {d.notes.map((n) => <NoteLine key={n.id} note={n} />)}
                </ul>
              </section>
            )}
            <Section title="First timers" count={d.firstTimers.length}>
              <ul>{d.firstTimers.map((p) => <PersonRow key={p.id} p={p} />)}</ul>
            </Section>
            <Section title="Second timers" hint="Grouped by when they first came." count={d.secondTimers.reduce((a, g) => a + g.people.length, 0)}>
              <Groups groups={d.secondTimers} />
            </Section>
            <Section title="Back after a break" hint={`Came back after missing ${d.breakWeeks}+ Sundays in a row.`} count={d.backAfterBreak.reduce((a, g) => a + g.people.length, 0)}>
              <Groups groups={d.backAfterBreak} />
            </Section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Set or clear a Sunday's label. Read-only for roles that can't manage headcounts. */
export function LabelEditor({ date, label }: { date: string; label: string | null }) {
  const canEdit = useCan()("headcount.manage")
  const [value, setValue] = useState(label ?? "")
  useEffect(() => setValue(label ?? ""), [label])
  const known = useQuery({ queryKey: ["sunday-labels"], queryFn: () => sundayLabelsAction(), enabled: canEdit })
  const save = useActionMutation((v: string) => setSundayLabelAction(date, v), {
    success: (_r, v) => (v.trim() ? `Marked as “${v.trim()}”` : "Marked as a regular Sunday"),
    onSuccess: () => void known.refetch(),
  })
  if (!canEdit) {
    return <div className="text-sm">{label ? <SundayLabelBadge label={label} /> : <span className="text-muted-foreground">Regular Sunday</span>}</div>
  }
  const listId = `sunday-labels-${date}`
  return (
    <form className="space-y-1.5 rounded-lg border bg-muted/30 p-3" onSubmit={(e) => { e.preventDefault(); save.mutate(value) }}>
      <label htmlFor={`label-${date}`} className="text-sm font-medium">Sunday label</label>
      <div className="flex gap-2">
        <Input id={`label-${date}`} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Regular Sunday (e.g. Flicks & Talks)" list={listId} maxLength={60} />
        <datalist id={listId}>{(known.data ?? []).map((l) => <option key={l} value={l} />)}</datalist>
        <Button variant="secondary" loading={save.isPending} disabled={value.trim() === (label ?? "")}>Save</Button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {(known.data ?? []).filter((l) => l !== value.trim()).slice(0, 6).map((l) => (
          <button key={l} type="button" onClick={() => setValue(l)} className="rounded-full border px-2 py-0.5 text-xs hover:bg-muted">{l}</button>
        ))}
        {label && (
          <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" disabled={save.isPending} onClick={() => { setValue(""); save.mutate("") }}>
            Make regular
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Tag special Sundays to compare their attendance on Trends.</p>
    </form>
  )
}
