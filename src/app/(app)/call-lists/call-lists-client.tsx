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
import { useCan } from "@/components/permissions"
import { decideSuggestionAction } from "./actions"

type Person = {
  id: number; name: string; phone: string | null; status: string; teams: string[]; personResponsible: string | null; lastDate: string | null
  /** WhatsApp link with the pre-defined message; null = not on WhatsApp / no usable number; undefined = not offered on this list. */
  whatsapp?: string | null
}

function WhatsappIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4 fill-current">
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35M12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.32l-.34-.2-3.57.94.95-3.48-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.23-9.43 9.44-9.43 2.52 0 4.89.98 6.67 2.77a9.37 9.37 0 0 1 2.76 6.67c0 5.2-4.23 9.43-9.44 9.43m8.03-17.46A11.27 11.27 0 0 0 12.05.72C5.8.72.7 5.8.7 12.06c0 2 .52 3.95 1.52 5.67L.6 23.28l5.68-1.49a11.3 11.3 0 0 0 5.77 1.47h.01c6.25 0 11.34-5.09 11.35-11.35 0-3.03-1.18-5.88-3.33-8.02" />
    </svg>
  )
}

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
            <div className="overflow-x-auto rounded-xl border bg-card">
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
                      <TableCell className="whitespace-nowrap text-right">
                        {p.whatsapp !== undefined && (p.whatsapp
                          ? <Button size="sm" variant="ghost" asChild className="text-[#128c7e] hover:text-[#128c7e]"><a href={p.whatsapp} target="_blank" rel="noopener noreferrer"><WhatsappIcon /> WhatsApp</a></Button>
                          : <span className="px-2 text-xs text-muted-foreground" title="They said this number isn't on WhatsApp, or the number can't be used">No WhatsApp</span>)}
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
  const canDecide = useCan()("callLists.manage")
  if (!items.length) return <EmptyState title="No suggestions waiting" />
  const pending = m.isPending
  const busy = (s: Suggestion, approve: boolean) => m.isPending && m.variables?.s.id === s.id && m.variables.approve === approve
  const decide = (s: Suggestion, approve: boolean) => m.mutate({ s, approve })
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Current</TableHead><TableHead>Suggested</TableHead><TableHead>Why</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {items.map((s) => (
            <TableRow key={s.id}>
              <TableCell><Link href={`/members/${s.memberId}`} className="font-medium hover:underline">{s.name}</Link><div className="text-xs text-muted-foreground">{displayPhone(s.phone)}</div></TableCell>
              <TableCell><StatusBadge status={s.from} /></TableCell>
              <TableCell>
                {canDecide ? (
                  <SelectField aria-label="New status" value={choice[s.id] ?? s.to} onChange={(e) => setChoice({ ...choice, [s.id]: e.target.value })}>
                    {statuses.map((st) => <option key={st}>{st}</option>)}
                  </SelectField>
                ) : <StatusBadge status={s.to} />}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{s.reason}</TableCell>
              <TableCell className="whitespace-nowrap text-right">
                {canDecide && <>
                <Button size="sm" loading={busy(s, true)} disabled={pending} onClick={() => decide(s, true)}>{!busy(s, true) && <Check className="size-4" />} Approve</Button>{" "}
                <Button size="sm" variant="ghost" loading={busy(s, false)} disabled={pending} onClick={() => decide(s, false)}>{!busy(s, false) && <X className="size-4" />} Dismiss</Button>
                </>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
