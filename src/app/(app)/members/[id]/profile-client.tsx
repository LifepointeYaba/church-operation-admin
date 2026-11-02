"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Download, GitMerge, Pencil, Trash2, Undo2, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { NativeSelect } from "@/components/native-select"
import { displayPhone } from "@/lib/phone"
import { formatDate } from "@/lib/dates"
import { cn } from "@/lib/utils"
import type { MemberInput } from "@/lib/members"
import { MemberForm } from "../member-form"
import {
  addFollowUpAction, deleteAction, eraseAction, mergeAction, restoreAction, revertAction, searchMembersAction, setTeamsAction,
} from "../actions"

export function AttendanceStrip({ items }: { items: { date: string; recordTaken: boolean; present: boolean }[] }) {
  const years = [...new Set(items.map((i) => i.date.slice(0, 4)))]
  return (
    <div className="space-y-3">
      {years.map((y) => (
        <div key={y} className="flex items-start gap-3">
          <span className="w-10 shrink-0 pt-0.5 text-xs text-muted-foreground tabular-nums">{y}</span>
          <div className="flex flex-wrap gap-1" role="list" aria-label={`Attendance ${y}`}>
            {items.filter((i) => i.date.startsWith(y)).map((i) => (
              <Tooltip key={i.date}>
                <TooltipTrigger asChild>
                  <span
                    role="listitem"
                    aria-label={`${formatDate(i.date, "long")}: ${!i.recordTaken ? "no record taken" : i.present ? "present" : "absent"}`}
                    className={cn(
                      "size-3.5 rounded-[3px]",
                      !i.recordTaken ? "bg-[repeating-linear-gradient(45deg,var(--muted),var(--muted)_2px,transparent_2px,transparent_4px)] ring-1 ring-border"
                        : i.present ? "bg-chart-1" : "bg-muted ring-1 ring-border",
                    )}
                  />
                </TooltipTrigger>
                <TooltipContent>{formatDate(i.date, "long")} · {!i.recordTaken ? "No record taken" : i.present ? "Present" : "Absent"}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      ))}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><span className="size-3 rounded-[3px] bg-chart-1" /> Present</span>
        <span className="inline-flex items-center gap-1"><span className="size-3 rounded-[3px] bg-muted ring-1 ring-border" /> Absent</span>
        <span className="inline-flex items-center gap-1"><span className="size-3 rounded-[3px] bg-[repeating-linear-gradient(45deg,var(--muted),var(--muted)_2px,transparent_2px,transparent_4px)] ring-1 ring-border" /> No record taken</span>
      </div>
    </div>
  )
}

export function ProfileActions({ memberId, initial, statuses, deleted }: { memberId: number; initial: Required<MemberInput>; statuses: string[]; deleted: boolean }) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [pending, start] = useTransition()
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string, after?: () => void) =>
    start(async () => {
      const r = await fn()
      if (r.ok) { toast.success(msg); if (after) after(); else router.refresh() } else toast.error(r.error)
    })
  return (
    <div className="flex flex-wrap gap-2">
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogTrigger asChild><Button><Pencil className="size-4" /> Edit</Button></DialogTrigger>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Edit details</DialogTitle><DialogDescription>Every save is logged and can be reverted.</DialogDescription></DialogHeader>
          <MemberForm memberId={memberId} initial={initial} statuses={statuses} onDone={() => setEditOpen(false)} />
        </DialogContent>
      </Dialog>
      <MergeDialog memberId={memberId} />
      <Button variant="outline" asChild><a href={`/api/export/member/${memberId}`}><Download className="size-4" /> Export data</a></Button>
      {deleted ? (
        <Button variant="outline" disabled={pending} onClick={() => act(() => restoreAction(memberId), "Restored")}><Undo2 className="size-4" /> Restore</Button>
      ) : (
        <Button variant="outline" disabled={pending} onClick={() => confirm("Delete this person? They can be restored for 30 days.") && act(() => deleteAction(memberId), "Deleted — restorable for 30 days")}>
          <Trash2 className="size-4" /> Delete
        </Button>
      )}
      <Button
        variant="destructive"
        disabled={pending}
        onClick={() => {
          const typed = prompt("Permanently erase this person and all their attendance? This cannot be undone. Type ERASE to confirm.")
          if (typed === "ERASE") act(() => eraseAction(memberId), "Erased permanently", () => router.push("/members"))
        }}
      >
        Erase permanently
      </Button>
    </div>
  )
}

function MergeDialog({ memberId }: { memberId: number }) {
  const router = useRouter()
  const [q, setQ] = useState("")
  const [results, setResults] = useState<Awaited<ReturnType<typeof searchMembersAction>>>([])
  const [pending, start] = useTransition()
  return (
    <Dialog>
      <DialogTrigger asChild><Button variant="outline"><GitMerge className="size-4" /> Merge</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Merge with another record</DialogTitle>
          <DialogDescription>All attendance, teams, follow-ups and history from this record move to the one you pick. This record is then removed.</DialogDescription>
        </DialogHeader>
        <Input value={q} placeholder="Search name or phone…" onChange={async (e) => { setQ(e.target.value); setResults((await searchMembersAction(e.target.value)).filter((r) => r.id !== memberId)) }} />
        <ul className="max-h-72 divide-y overflow-y-auto">
          {results.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span>{r.firstName} {r.lastName} <span className="text-muted-foreground">{displayPhone(r.phone)} · {r.status} · #{r.id}</span></span>
              <Button size="sm" disabled={pending} onClick={() => confirm(`Merge into ${r.firstName} ${r.lastName}?`) && start(async () => {
                const res = await mergeAction(r.id, memberId)
                if (res.ok) { toast.success("Merged"); router.push(`/members/${r.id}`) } else toast.error(res.error)
              })}>Merge into</Button>
            </li>
          ))}
          {q.length >= 2 && results.length === 0 && <li className="py-2 text-sm text-muted-foreground">No matches</li>}
        </ul>
      </DialogContent>
    </Dialog>
  )
}

export function TeamsEditor({ memberId, current, all }: { memberId: number; current: string[]; all: string[] }) {
  const router = useRouter()
  const [teams, setTeams] = useState(current)
  const [add, setAdd] = useState("")
  const [pending, start] = useTransition()
  const save = (next: string[]) => {
    setTeams(next)
    start(async () => {
      const r = await setTeamsAction(memberId, next)
      if (r.ok) { toast.success("Teams updated"); router.refresh() } else toast.error(r.error)
    })
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {teams.length === 0 && <span className="text-sm text-muted-foreground">No team</span>}
        {teams.map((t) => (
          <Badge key={t} variant="secondary" className="gap-1 pr-1">
            {t}
            <button aria-label={`Remove ${t}`} disabled={pending} onClick={() => save(teams.filter((x) => x !== t))} className="rounded p-0.5 hover:bg-background"><X className="size-3" /></button>
          </Badge>
        ))}
      </div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (add.trim() && !teams.includes(add.trim())) save([...teams, add.trim()]); setAdd("") }}>
        <Input value={add} onChange={(e) => setAdd(e.target.value)} placeholder="Add team…" list="all-teams" />
        <datalist id="all-teams">{all.filter((t) => !teams.includes(t)).map((t) => <option key={t} value={t} />)}</datalist>
        <Button variant="secondary" disabled={pending}>Add</Button>
      </form>
    </div>
  )
}

export function FollowUpForm({ memberId }: { memberId: number }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <form
      className="grid gap-2 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault()
        const form = e.currentTarget
        const fd = new FormData(form)
        start(async () => {
          const r = await addFollowUpAction(memberId, {
            method: String(fd.get("method")), outcome: String(fd.get("outcome")), note: String(fd.get("note") ?? ""), date: String(fd.get("date") ?? ""),
          })
          if (r.ok) { toast.success("Follow-up logged"); form.reset(); router.refresh() } else toast.error(r.error)
        })
      }}
    >
      <NativeSelect name="method" aria-label="Method" defaultValue="Call">
        <option>Call</option><option>WhatsApp</option><option>SMS</option><option>Visit</option><option>In person</option>
      </NativeSelect>
      <NativeSelect name="outcome" aria-label="Outcome" defaultValue="Reached">
        <option>Reached</option><option>No answer</option><option>Wrong number</option><option>Will come Sunday</option><option>Moved away</option><option>Other</option>
      </NativeSelect>
      <Input name="date" type="date" aria-label="Date" defaultValue={new Date().toISOString().slice(0, 10)} />
      <Textarea name="note" placeholder="Note (optional)" rows={1} className="min-h-9" />
      <Button className="sm:col-span-2" variant="secondary" disabled={pending}>Log follow-up</Button>
    </form>
  )
}

export function RevertButton({ auditId }: { auditId: number }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => {
      const r = await revertAction(auditId)
      if (r.ok) { toast.success("Change reverted"); router.refresh() } else toast.error(r.error)
    })}><Undo2 className="size-4" /> Revert</Button>
  )
}
