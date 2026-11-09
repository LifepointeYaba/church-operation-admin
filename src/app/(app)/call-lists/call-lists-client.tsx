"use client"

import { useState } from "react"
import Link from "next/link"
import { Check, Download, FileText, MessageSquarePlus, X } from "lucide-react"
import { useActionMutation } from "@/hooks/use-action-mutation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { SelectField } from "@/components/select-field"
import { EmptyState, StatusBadge } from "@/components/common"
import { displayPhone } from "@/lib/phone"
import { formatDate } from "@/lib/dates"
import { FollowUpForm } from "../members/[id]/profile-client"
import { decideSuggestionAction } from "./actions"

type Person = { id: number; name: string; phone: string | null; status: string; teams: string[]; personResponsible: string | null; lastDate: string | null }

export function CallListTabs({ date, lists }: { date: string; lists: { key: string; label: string; people: Person[] }[] }) {
  return (
    <Tabs defaultValue={lists.find((l) => l.people.length)?.key ?? lists[0].key}>
      <div className="overflow-x-auto">
        <TabsList>
          {lists.map((l) => <TabsTrigger key={l.key} value={l.key}>{l.label} <Badge variant="secondary" className="ml-1">{l.people.length}</Badge></TabsTrigger>)}
        </TabsList>
      </div>
      {lists.map((l) => (
        <TabsContent key={l.key} value={l.key} className="space-y-3">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild><a href={`/api/export/call-list?list=${l.key}&date=${date}`}><Download className="size-4" /> CSV</a></Button>
            <Button variant="outline" size="sm" asChild><a href={`/api/export/call-list?list=${l.key}&date=${date}&format=pdf`}><FileText className="size-4" /> PDF</a></Button>
          </div>
          {l.people.length === 0 ? <EmptyState title="No one on this list" /> : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Status</TableHead><TableHead>Team</TableHead><TableHead>Responsible</TableHead><TableHead>Last attended</TableHead><TableHead /></TableRow>
                </TableHeader>
                <TableBody>
                  {l.people.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell><Link href={`/members/${p.id}`} className="font-medium hover:underline">{p.name}</Link></TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">{p.phone ? <a href={`tel:${p.phone}`} className="hover:underline">{displayPhone(p.phone)}</a> : "—"}</TableCell>
                      <TableCell><StatusBadge status={p.status} /></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.teams.join(", ") || "—"}</TableCell>
                      <TableCell className="text-sm">{p.personResponsible ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.lastDate ? formatDate(p.lastDate, "long") : "Never"}</TableCell>
                      <TableCell>
                        <Popover>
                          <PopoverTrigger asChild><Button size="sm" variant="ghost"><MessageSquarePlus className="size-4" /> Log</Button></PopoverTrigger>
                          <PopoverContent align="end" className="w-80"><FollowUpForm memberId={p.id} /></PopoverContent>
                        </Popover>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      ))}
    </Tabs>
  )
}

type Suggestion = { id: number; memberId: number; name: string; phone: string | null; from: string; to: string; reason: string }

export function SuggestionReview({ items, statuses }: { items: Suggestion[]; statuses: string[] }) {
  const [choice, setChoice] = useState<Record<number, string>>({})
  const m = useActionMutation(
    (v: { s: Suggestion; approve: boolean }) => decideSuggestionAction(v.s.id, v.approve, choice[v.s.id] ?? v.s.to),
    { success: (_r, v) => v.approve ? `${v.s.name}: status changed to ${choice[v.s.id] ?? v.s.to}` : `Suggestion for ${v.s.name} dismissed` },
  )
  if (!items.length) return <EmptyState title="No suggestions waiting" />
  const pending = m.isPending
  const busy = (s: Suggestion, approve: boolean) => m.isPending && m.variables?.s.id === s.id && m.variables.approve === approve
  const decide = (s: Suggestion, approve: boolean) => m.mutate({ s, approve })
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Current</TableHead><TableHead>Suggested</TableHead><TableHead>Why</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {items.map((s) => (
            <TableRow key={s.id}>
              <TableCell><Link href={`/members/${s.memberId}`} className="font-medium hover:underline">{s.name}</Link><div className="text-xs text-muted-foreground">{displayPhone(s.phone)}</div></TableCell>
              <TableCell><StatusBadge status={s.from} /></TableCell>
              <TableCell>
                <SelectField aria-label="New status" value={choice[s.id] ?? s.to} onChange={(e) => setChoice({ ...choice, [s.id]: e.target.value })}>
                  {statuses.map((st) => <option key={st}>{st}</option>)}
                </SelectField>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{s.reason}</TableCell>
              <TableCell className="whitespace-nowrap text-right">
                <Button size="sm" loading={busy(s, true)} disabled={pending} onClick={() => decide(s, true)}>{!busy(s, true) && <Check className="size-4" />} Approve</Button>{" "}
                <Button size="sm" variant="ghost" loading={busy(s, false)} disabled={pending} onClick={() => decide(s, false)}>{!busy(s, false) && <X className="size-4" />} Dismiss</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
