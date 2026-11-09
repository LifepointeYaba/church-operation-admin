"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/native-select"
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
  const router = useRouter()
  const [query, setQuery] = useState(person.name)
  const [members, setMembers] = useState<MemberCandidate[]>([])
  const [selected, setSelected] = useState<MemberCandidate | null>(null)
  const [status, setStatus] = useState(defaultStatus)
  const [pending, start] = useTransition()

  function search() {
    start(async () => {
      const result = await searchPendingAttendanceMembers(uploadId, person.row, query)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setMembers(result.members)
      setSelected(null)
      if (!result.members.length) toast.info("No existing members found")
    })
  }

  function decide(decision: "approve" | "reject", memberId?: number) {
    start(async () => {
      const result = await resolvePendingAttendanceImport(uploadId, person.row, decision, status, memberId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(decision === "approve" ? selected ? "Attendance linked to existing member" : "New member approved" : "Person rejected")
      router.refresh()
    })
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
        <Button variant="secondary" disabled={pending} onClick={search}>Find existing member</Button>
      </div>
      {members.length > 0 && (
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
            <NativeSelect aria-label={`New member status for ${person.name}`} value={status} onChange={(event) => setStatus(event.target.value)} disabled={pending}>
              {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
            </NativeSelect>
            <Button disabled={pending} onClick={() => decide("approve")}>Create new & approve</Button>
          </>
        )}
        {selected && <Button disabled={pending} onClick={() => decide("approve", selected.id)}>Link and approve</Button>}
        <Button variant="outline" disabled={pending} onClick={() => decide("reject")}>Reject</Button>
      </div>
    </li>
  )
}
