"use client"

import { useState } from "react"
import { Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/notifications"

/** Downloads the Absent Members list as CSV with the card's current filters, then confirms with an alert. */
export function AbsentExportButton({ params, disabled }: { params: Record<string, string>; disabled?: boolean }) {
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    try {
      const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v))
      const res = await fetch(`/api/export/absent-members?${q}`)
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `Export failed (${res.status})`)
      const blob = await res.blob()
      const name = res.headers.get("Content-Disposition")?.match(/filename="(.+?)"/)?.[1] ?? "absent-members.csv"
      const count = Number(res.headers.get("X-Row-Count") ?? 0)
      const url = URL.createObjectURL(blob)
      const a = Object.assign(document.createElement("a"), { href: url, download: name })
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success("Export successful", { description: `${count} ${count === 1 ? "person" : "people"} saved to ${name}` })
    } catch (e) {
      toast.error("Couldn’t export the list", { description: e instanceof Error ? e.message : "Check your connection and try again." })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Button variant="outline" size="sm" onClick={run} disabled={busy || disabled} className="h-9">
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Export CSV
    </Button>
  )
}
