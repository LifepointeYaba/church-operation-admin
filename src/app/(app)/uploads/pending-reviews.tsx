"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { toast } from "@/components/notifications"
import { useActionMutation } from "@/hooks/use-action-mutation"
import { useConfirm } from "@/components/confirm-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SelectField } from "@/components/select-field"
import { resolvePendingAttendanceImport, searchPendingAttendanceMembers } from "./actions"

type SearchResult = Extract<Awaited<ReturnType<typeof searchPendingAttendanceMembers>>, { ok: true }>
type MemberCandidate = SearchResult["members"][number]
type PendingPerson = { row: number; name: string; phone: string | null; email: string | null; gender: string | null }
type PendingUpload = { id: number; fileName: string; people: PendingPerson[] }

export function PendingAttendanceReviews({ uploads, statuses }: { uploads: PendingUpload[]; statuses: string[] }) {
  if (!uploads.length) return null
  const defaultStatus = (statuses.includes("Member") ? "Member" : statuses[0]) ?? "Member"

  return (
    <div className="space-y-4">
      {uploads.map((upload) => (
        <section key={upload.id} className="space-y-2 rounded-lg border p-4">
          <h3 className="text-sm font-semibold">Review people from {upload.fileName}</h3>
          <ul className="divide-y">
            {upload.people.map((person) => (
              <PendingPersonReview key={person.row} uploadId={upload.id} person={person} statuses={statuses} defaultStatus={defaultStatus} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function PendingPersonReview({
  uploadId,
  person,
  statuses,
  defaultStatus,
}: {
  uploadId: number
  person: PendingPerson
  statuses: string[]
  defaultStatus: string
}) {
  const confirm = useConfirm()
  const [query, setQuery] = useState(person.name)
  const [members, setMembers] = useState<MemberCandidate[]>([])
  const [selected, setSelected] = useState<MemberCandidate | null>(null)
  const [status, setStatus] = useState(defaultStatus)
  // Searching is a read, so it uses a plain React Query mutation (no page refresh).
  const searchMutation = useMutation({
    mutationFn: async (q: string) => {
      const result = await searchPendingAttendanceMembers(uploadId, person.row, q)
      if (!result.ok) throw new Error(result.error)
      return result.members
    },
    onSuccess: (found) => {
      setMembers(found)
      setSelected(null)
      if (!found.length) toast.info("No existing members found", { description: "Try a phone number or a different spelling." })
    },
    onError: (e) => toast.error(e.message),
  })
  const decideMutation = useActionMutation(
    (v: { decision: "approve" | "reject"; memberId?: number }) => resolvePendingAttendanceImport(uploadId, person.row, v.decision, status, v.memberId),
    {
      success: (_r, v) => v.decision === "reject"
        ? `${person.name} rejected`
        : v.memberId ? `${person.name} merged into ${selected?.firstName ?? "member"} ${selected?.lastName ?? ""}`.trim() : `${person.name} added as a new member`,
    },
  )
  const pending = searchMutation.isPending || decideMutation.isPending

  function search() {
    searchMutation.mutate(query)
  }

  async function decide(decision: "approve" | "reject", memberId?: number) {
    if (decision === "reject") {
      const ok = await confirm({ title: `Reject ${person.name}?`, description: "Their attendance from this file won’t be recorded.", confirmLabel: "Reject", destructive: true })
      if (!ok) return
    }
    decideMutation.mutate({ decision, memberId })
  }

  return (
    <li className="space-y-3 py-4">
      <div>
        <p className="font-medium">{person.name} <span className="text-muted-foreground">(row {person.row})</span></p>
        <p className="text-xs text-muted-foreground">
          Uploaded: {[person.phone, person.email, person.gender].filter(Boolean).join(" · ") || "No contact details"}
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          aria-label={`Search existing members for ${person.name}`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); search() } }}
          placeholder="Search by name, phone, or email"
          disabled={pending}
        />
        <Button variant="secondary" loading={searchMutation.isPending} disabled={pending} onClick={search}>Find existing member</Button>
      </div>
      {searchMutation.isPending && (
        <div className="space-y-2 rounded-md bg-muted/40 p-3" aria-busy="true">
          {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      )}
      {!searchMutation.isPending && members.length > 0 && (
        <ul className="space-y-2 rounded-md bg-muted/40 p-3">
          {members.map((member) => (
            <li key={member.id}>
              <button
                type="button"
                className={`w-full rounded-md border p-3 text-left text-sm ${selected?.id === member.id ? "border-primary bg-background" : "border-transparent hover:bg-background"}`}
                onClick={() => setSelected(member)}
                disabled={pending}
              >
                <span className="block font-medium">{member.firstName} {member.lastName}</span>
                <span className="text-muted-foreground">
                  {[member.phone, member.altPhone, member.email, member.gender, member.status].filter(Boolean).join(" · ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {selected && (
        <p className="text-sm text-primary">
          Selected: {selected.firstName} {selected.lastName}. Approval will add attendance and fill blank profile fields only.
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {!selected && (
          <>
            <SelectField aria-label={`New member status for ${person.name}`} value={status} onChange={(event) => setStatus(event.target.value)} disabled={pending}>
              {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
            </SelectField>
            <Button loading={decideMutation.isPending && decideMutation.variables?.decision === "approve"} disabled={pending} onClick={() => decide("approve")}>Create new & approve</Button>
          </>
        )}
        {selected && <Button loading={decideMutation.isPending && decideMutation.variables?.decision === "approve"} disabled={pending} onClick={() => decide("approve", selected.id)}>Link and approve</Button>}
        <Button variant="outline" loading={decideMutation.isPending && decideMutation.variables?.decision === "reject"} disabled={pending} onClick={() => decide("reject")}>Reject</Button>
      </div>
    </li>
  )
}
