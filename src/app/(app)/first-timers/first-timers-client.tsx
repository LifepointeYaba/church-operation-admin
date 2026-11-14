"use client"

import { useState } from "react"
import { Check, Copy, Download, Link2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/notifications"
import { useSearchParamNavigation } from "@/components/navigation"
import { useActionMutation, useRunAction } from "@/hooks/use-action-mutation"
import { generateLinkAction, setLinkActiveAction } from "./actions"

export function GenerateLinkForm({ date, hasLink }: { date: string; hasLink: boolean }) {
  const { setParams } = useSearchParamNavigation()
  const [value, setValue] = useState(date)
  const m = useActionMutation((d: string) => generateLinkAction(d), {
    success: (r) => r.created ? { title: "Link created", description: "Share the link or download the QR code." } : "Link ready",
  })
  const isSunday = value && new Date(`${value}T00:00:00Z`).getUTCDay() === 0
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => { e.preventDefault(); m.mutate(value) }}
    >
      <label className="space-y-1 text-sm">
        <span className="block font-medium">Sunday</span>
        <Input type="date" className="h-9 w-auto" value={value}
          onChange={(e) => { setValue(e.target.value); if (e.target.value && new Date(`${e.target.value}T00:00:00Z`).getUTCDay() === 0) setParams({ date: e.target.value }) }} />
      </label>
      {!hasLink && (
        <Button loading={m.isPending} disabled={!isSunday}><Link2 className="size-4" /> Generate link</Button>
      )}
      {value && !isSunday && <p className="w-full text-sm text-destructive">Pick a Sunday.</p>}
    </form>
  )
}

export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button size="sm" variant="outline" type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url)
          setCopied(true)
          toast.success("Link copied")
          setTimeout(() => setCopied(false), 2000)
        } catch {
          toast.error("Couldn’t copy", { description: "Select the link and copy it by hand." })
        }
      }}>
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />} Copy
    </Button>
  )
}

export function DownloadQrButton({ href, fileName, label, variant = "default" }: { href: string; fileName: string; label: string; variant?: "default" | "ghost" }) {
  return (
    <Button size="sm" variant={variant} asChild>
      <a href={href} download={fileName} onClick={() => toast.success("QR code downloaded", { description: fileName })}>
        <Download className="size-4" /> {label}
      </a>
    </Button>
  )
}

export function LinkActiveToggle({ id, active }: { id: number; active: boolean }) {
  const { run, isPending } = useRunAction()
  return (
    <Button size="sm" variant="outline" loading={isPending}
      onClick={() => run(() => setLinkActiveAction(id, !active), active ? "Form closed" : "Form reopened")}>
      {active ? "Close form" : "Reopen form"}
    </Button>
  )
}
