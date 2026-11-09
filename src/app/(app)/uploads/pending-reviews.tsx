"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { NativeSelect } from "@/components/native-select"
import { resolvePendingAttendanceImport } from "./actions"

type PendingUpload = {
  id: number
  fileName: string
  people: { row: number; name: string }[]
}

export function PendingAttendanceReviews({ uploads, statuses }: { uploads: PendingUpload[]; statuses: string[] }) {
  const router = useRouter()
  const [selectedStatuses, setSelectedStatuses] = useState<Record<string, string>>({})
  const [pending, start] = useTransition()
  const defaultStatus = (statuses.includes("Member") ? "Member" : statuses[0]) ?? "Member"
  if (!uploads.length) return null

  function decide(uploadId: number, row: number, decision: "approve" | "reject") {
    const key = `${uploadId}:${row}`
    start(async () => {
      const result = await resolvePendingAttendanceImport(
        uploadId,
        row,
        decision,
        selectedStatuses[key] ?? defaultStatus,
      )
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(decision === "approve" ? "Person approved and added" : "Person rejected")
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {uploads.map((upload) => (
        <section key={upload.id} className="space-y-2 rounded-lg border p-4">
          <h3 className="text-sm font-semibold">Review people from {upload.fileName}</h3>
          <ul className="divide-y">
            {upload.people.map((person) => {
              const key = `${upload.id}:${person.row}`
              return (
                <li key={person.row} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
                  <span className="min-w-0 flex-1">{person.name} <span className="text-muted-foreground">(row {person.row})</span></span>
                  <NativeSelect
                    aria-label={`Status for ${person.name}`}
                    value={selectedStatuses[key] ?? defaultStatus}
                    onChange={(event) => setSelectedStatuses((current) => ({ ...current, [key]: event.target.value }))}
                    disabled={pending}
                  >
                    {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
                  </NativeSelect>
                  <Button size="sm" disabled={pending} onClick={() => decide(upload.id, person.row, "approve")}>Approve</Button>
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => decide(upload.id, person.row, "reject")}>Reject</Button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
