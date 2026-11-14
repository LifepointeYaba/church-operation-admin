"use client"

import { useState } from "react"
import { Check, Copy, Download, Link2, Trash2 } from "lucide-react"
import { useConfirm } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/notifications"
import { useSearchParamNavigation } from "@/components/navigation"
import { useActionMutation, useRunAction } from "@/hooks/use-action-mutation"
import { deleteLinkAction, deleteRegistrationAction, generateLinkAction, setLinkActiveAction } from "./actions"

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
      <label className="min-w-0 flex-1 space-y-1 text-sm sm:flex-none">
        <span className="block font-medium">Sunday</span>
        <Input type="date" className="h-10 w-full sm:h-9 sm:w-auto" value={value}
          onChange={(e) => { setValue(e.target.value); if (e.target.value && new Date(`${e.target.value}T00:00:00Z`).getUTCDay() === 0) setParams({ date: e.target.value }) }} />
      </label>
      {!hasLink && (
        <Button className="h-10 w-full sm:h-9 sm:w-auto" loading={m.isPending} disabled={!isSunday}><Link2 className="size-4" /> Generate link</Button>
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

export function DownloadQrButton({ href, fileName, label, variant = "default" }: { href: string; fileName: string; label: string; variant?: "default" | "ghost" | "outline" }) {
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

export function DeleteRegistrationButton({ id, name }: { id: number; name: string }) {
  const confirm = useConfirm()
  const m = useActionMutation((v: number) => deleteRegistrationAction(v), {
    success: (r) => ({ title: `${r.name} deleted`, description: r.memberDeleted ? "Their registration, attendance and member record were removed." : "Their registration and attendance for this Sunday were removed." }),
  })
  return (
    <Button size="icon" variant="ghost" aria-label={`Delete ${name}`} loading={m.isPending}
      onClick={async () => {
        const ok = await confirm({
          title: `Delete ${name}?`,
          description: "Removes this registration and the attendance it added for this Sunday. If the form created this person and they have no other attendance, their member record is deleted too. This can’t be undone.",
          confirmLabel: "Delete", destructive: true,
        })
        if (ok) m.mutate(id)
      }}>
      {!m.isPending && <Trash2 className="size-4" />}
    </Button>
  )
}

export function DeleteLinkButton({ id, label, registrations, size = "sm" }: { id: number; label: string; registrations: number; size?: "sm" | "icon" }) {
  const confirm = useConfirm()
  const m = useActionMutation((v: number) => deleteLinkAction(v), {
    success: (r) => ({ title: "Link deleted", description: `${r.registrations} registration${r.registrations === 1 ? "" : "s"} and their attendance removed${r.membersDeleted ? `; ${r.membersDeleted} member record${r.membersDeleted === 1 ? "" : "s"} deleted` : ""}.` }),
  })
  return (
    <Button size={size} variant={size === "icon" ? "ghost" : "outline"} aria-label={`Delete the link for ${label}`} loading={m.isPending}
      className="text-destructive hover:text-destructive"
      onClick={async () => {
        const ok = await confirm({
          title: `Delete the link for ${label}?`,
          description: registrations
            ? `This deletes the link, all ${registrations} registration${registrations === 1 ? "" : "s"} on it, and the attendance they added. People the form created who have no other attendance are deleted too. The QR code stops working. This can’t be undone.`
            : "The link and its QR code stop working. This can’t be undone.",
          confirmLabel: "Delete link", destructive: true,
        })
        if (ok) m.mutate(id)
      }}>
      {!m.isPending && <Trash2 className="size-4" />}{size === "sm" && " Delete link"}
    </Button>
  )
}
