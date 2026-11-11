"use client"

import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { Download, GitMerge, Pencil, Trash2, Undo2, X } from "lucide-react"
import { useActionMutation, useRunAction } from "@/hooks/use-action-mutation"
import { useConfirm } from "@/components/confirm-dialog"
import { useCan } from "@/components/permissions"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { SelectField } from "@/components/select-field"
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
  const confirm = useConfirm()
  const [editOpen, setEditOpen] = useState(false)
  const { run, isPending } = useRunAction()
  const can = useCan()
  const canDelete = can("members.delete")
  return (
    <div className="flex flex-wrap gap-2">
      {can("members.edit") && <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogTrigger asChild><Button><Pencil className="size-4" /> Edit</Button></DialogTrigger>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Edit details</DialogTitle><DialogDescription>Every save is logged and can be reverted.</DialogDescription></DialogHeader>
          <MemberForm memberId={memberId} initial={initial} statuses={statuses} onDone={() => setEditOpen(false)} />
        </DialogContent>
      </Dialog>}
      {canDelete && <MergeDialog memberId={memberId} />}
      {can("members.export") && <Button variant="outline" asChild><a href={`/api/export/member/${memberId}`}><Download className="size-4" /> Export data</a></Button>}
      {!canDelete ? null : deleted ? (
        <Button variant="outline" loading={isPending} onClick={() => run(() => restoreAction(memberId), "Restored")}>{!isPending && <Undo2 className="size-4" />} Restore</Button>
      ) : (
        <Button variant="outline" disabled={isPending} onClick={async () => {
          const ok = await confirm({ title: "Delete this person?", description: "They’ll be hidden from lists and reports. You can restore them for 30 days.", confirmLabel: "Delete", destructive: true })
          if (ok) run(() => deleteAction(memberId), { title: "Deleted", description: "Restorable for 30 days from the Members page." })
        }}>
          <Trash2 className="size-4" /> Delete
        </Button>
      )}
      {canDelete && <Button
        variant="destructive"
        disabled={isPending}
        onClick={async () => {
          const ok = await confirm({
            title: "Erase permanently?",
            description: "This removes the person and all their attendance for good. It cannot be undone.",
            confirmLabel: "Erase permanently", destructive: true, requireText: "ERASE",
          })
          if (ok) run(() => eraseAction(memberId), "Erased permanently", () => router.push("/members"))
        }}
      >
        Erase permanently
      </Button>}
    </div>
  )
}

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

function MergeDialog({ memberId }: { memberId: number }) {
  const router = useRouter()
  const confirm = useConfirm()
  const [q, setQ] = useState("")
  const term = useDebounced(q.trim())
  const search = useQuery({
    queryKey: ["member-search", term],
    queryFn: () => searchMembersAction(term),
    enabled: term.length >= 2,
  })
  const results = (search.data ?? []).filter((r) => r.id !== memberId)
  const merge = useActionMutation((targetId: number) => mergeAction(targetId, memberId), {
    success: "Records merged",
    onSuccess: (_d, targetId) => router.push(`/members/${targetId}`),
    refresh: false,
  })
  return (
    <Dialog>
      <DialogTrigger asChild><Button variant="outline"><GitMerge className="size-4" /> Merge</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Merge with another record</DialogTitle>
          <DialogDescription>All attendance, teams, follow-ups and history from this record move to the one you pick. This record is then removed.</DialogDescription>
        </DialogHeader>
        <Input value={q} placeholder="Search name or phone…" aria-label="Search members to merge with" onChange={(e) => setQ(e.target.value)} autoFocus />
        <ul className="max-h-72 divide-y overflow-y-auto" aria-busy={search.isFetching}>
          {search.isFetching && Array.from({ length: 3 }, (_, i) => (
            <li key={i} className="flex items-center justify-between gap-2 py-2.5"><Skeleton className="h-4 w-48" /><Skeleton className="h-8 w-24" /></li>
          ))}
          {!search.isFetching && results.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span>{r.firstName} {r.lastName} <span className="text-muted-foreground">{displayPhone(r.phone)} · {r.status} · #{r.id}</span></span>
              <Button size="sm" loading={merge.isPending && merge.variables === r.id} disabled={merge.isPending} onClick={async () => {
                const ok = await confirm({ title: `Merge into ${r.firstName} ${r.lastName}?`, description: "This record will be removed after its history moves across.", confirmLabel: "Merge" })
                if (ok) merge.mutate(r.id)
              }}>Merge into</Button>
            </li>
          ))}
          {!search.isFetching && term.length >= 2 && search.isSuccess && results.length === 0 && <li className="py-2 text-sm text-muted-foreground">No matches</li>}
          {term.length < 2 && <li className="py-2 text-sm text-muted-foreground">Type at least 2 letters to search.</li>}
        </ul>
      </DialogContent>
    </Dialog>
  )
}

export function TeamsEditor({ memberId, current, all }: { memberId: number; current: string[]; all: string[] }) {
  const [teams, setTeams] = useState(current)
  const [add, setAdd] = useState("")
  const save = useActionMutation((next: string[]) => setTeamsAction(memberId, next), {
    success: "Teams updated",
    onFailure: () => { setTeams(current) },
  })
  const update = (next: string[]) => { setTeams(next); save.mutate(next) }
  const canEdit = useCan()("members.edit")
  if (!canEdit) {
    return (
      <div className="flex flex-wrap gap-2">
        {teams.length === 0 ? <span className="text-sm text-muted-foreground">No team</span> : teams.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
      </div>
    )
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {teams.length === 0 && <span className="text-sm text-muted-foreground">No team</span>}
        {teams.map((t) => (
          <Badge key={t} variant="secondary" className="gap-1 pr-1">
            {t}
            <button aria-label={`Remove ${t}`} disabled={save.isPending} onClick={() => update(teams.filter((x) => x !== t))} className="rounded p-0.5 hover:bg-background"><X className="size-3" /></button>
          </Badge>
        ))}
      </div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (add.trim() && !teams.includes(add.trim())) update([...teams, add.trim()]); setAdd("") }}>
        <Input value={add} onChange={(e) => setAdd(e.target.value)} placeholder="Add team…" list="all-teams" aria-label="Add team" />
        <datalist id="all-teams">{all.filter((t) => !teams.includes(t)).map((t) => <option key={t} value={t} />)}</datalist>
        <Button variant="secondary" loading={save.isPending}>Add</Button>
      </form>
    </div>
  )
}

export function FollowUpForm({ memberId }: { memberId: number }) {
  const [formKey, setFormKey] = useState(0)
  const log = useActionMutation((input: Parameters<typeof addFollowUpAction>[1]) => addFollowUpAction(memberId, input), {
    success: "Follow-up logged",
    onSuccess: () => setFormKey((k) => k + 1),
  })
  if (!useCan()("followUps.log")) return null
  return (
    <form
      key={formKey}
      className="grid gap-2 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        log.mutate({ method: String(fd.get("method")), outcome: String(fd.get("outcome")), note: String(fd.get("note") ?? ""), date: String(fd.get("date") ?? "") })
      }}
    >
      <SelectField name="method" aria-label="Method" defaultValue="Call" className="w-full">
        <option>Call</option><option>WhatsApp</option><option>SMS</option><option>Visit</option><option>In person</option>
      </SelectField>
      <SelectField name="outcome" aria-label="Outcome" defaultValue="Reached" className="w-full">
        <option>Reached</option><option>No answer</option><option>Wrong number</option><option>Will come Sunday</option><option>Moved away</option><option>Other</option>
      </SelectField>
      <Input name="date" type="date" aria-label="Date" defaultValue={new Date().toISOString().slice(0, 10)} />
      <Textarea name="note" placeholder="Note (optional)" rows={1} className="min-h-9" aria-label="Note" />
      <Button className="sm:col-span-2" variant="secondary" loading={log.isPending}>Log follow-up</Button>
    </form>
  )
}

export function RevertButton({ auditId }: { auditId: number }) {
  const confirm = useConfirm()
  const revert = useActionMutation(() => revertAction(auditId), { success: "Change reverted" })
  if (!useCan()("members.delete")) return null
  return (
    <Button size="sm" variant="ghost" loading={revert.isPending} onClick={async () => {
      if (await confirm({ title: "Revert this change?", description: "The details go back to how they were before this change. The revert itself is logged." , confirmLabel: "Revert" })) revert.mutate(undefined)
    }}>{!revert.isPending && <Undo2 className="size-4" />} Revert</Button>
  )
}
