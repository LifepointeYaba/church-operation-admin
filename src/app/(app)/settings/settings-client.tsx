"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { Check, Pencil, Trash2 } from "lucide-react"
import { useRunAction } from "@/hooks/use-action-mutation"
import { useConfirm } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { AppSettings } from "@/lib/settings"
import { saveThemePref } from "../actions"
import {
  addTeamAction, changePasswordAction, deleteTeamAction, renameTeamAction, saveStatusesAction, saveThresholdsAction,
} from "./actions"

/** Save/delete helper: React Query mutation with loading state and success/failure alerts. */
function useAct() {
  const { run, isPending } = useRunAction()
  return { pending: isPending, act: run }
}

export function ThresholdsForm({ initial }: { initial: AppSettings }) {
  const { pending, act } = useAct()
  const fields = [
    ["atRiskWeeks", "At risk after missing (Sundays)"],
    ["inactiveWeeks", "Inactive after missing (Sundays)"],
    ["minVisitsForRisk", "Only count people with at least (visits)"],
    ["workerMissWeeks", "Flag workers after missing (Sundays)"],
  ] as const
  const [v, setV] = useState(Object.fromEntries(fields.map(([k]) => [k, String(initial[k])])))
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); act(() => saveThresholdsAction(v as never), "Thresholds saved") }}>
      {fields.map(([k, label]) => (
        <div key={k} className="flex items-center justify-between gap-3">
          <Label htmlFor={k}>{label}</Label>
          <Input id={k} inputMode="numeric" className="w-20 text-right" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value.replace(/\D/g, "") })} />
        </div>
      ))}
      <Button loading={pending}>Save</Button>
    </form>
  )
}

export function StatusesForm({ initial }: { initial: string[] }) {
  const { pending, act } = useAct()
  const [text, setText] = useState(initial.join("\n"))
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); act(() => saveStatusesAction(text.split("\n")), "Statuses saved") }}>
      <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} />
      <Button loading={pending}>Save</Button>
    </form>
  )
}

export function TeamsManager({ teams }: { teams: { id: number; name: string; count: number }[] }) {
  const { pending, act } = useAct()
  const confirm = useConfirm()
  const [editing, setEditing] = useState<number | null>(null)
  const [name, setName] = useState("")
  const [add, setAdd] = useState("")
  return (
    <div className="space-y-3">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); act(() => addTeamAction(add), "Team added", () => setAdd("")) }}>
        <Input value={add} onChange={(e) => setAdd(e.target.value)} placeholder="New team name" />
        <Button variant="secondary" loading={pending} disabled={!add.trim()}>Add</Button>
      </form>
      <ul className="max-h-[480px] divide-y overflow-y-auto text-sm">
        {teams.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-2 py-1.5">
            {editing === t.id ? (
              <form className="flex flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); act(() => renameTeamAction(t.id, name), "Team updated", () => setEditing(null)) }}>
                <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus className="h-8" />
                <Button size="icon" variant="ghost" aria-label="Save" loading={pending}>{!pending && <Check className="size-4" />}</Button>
              </form>
            ) : (
              <span>{t.name} <span className="text-muted-foreground">· {t.count}</span></span>
            )}
            <span className="flex shrink-0">
              <Button size="icon" variant="ghost" aria-label={`Rename ${t.name}`} onClick={() => { setEditing(t.id); setName(t.name) }}><Pencil className="size-4" /></Button>
              <Button size="icon" variant="ghost" aria-label={`Delete ${t.name}`} disabled={pending}
                onClick={async () => {
                  const ok = await confirm({ title: `Delete “${t.name}”?`, description: `${t.count} ${t.count === 1 ? "person" : "people"} will lose this team. This can’t be undone.`, confirmLabel: "Delete team", destructive: true })
                  if (ok) act(() => deleteTeamAction(t.id), "Team deleted")
                }}>
                <Trash2 className="size-4" />
              </Button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function PasswordForm() {
  const router = useRouter()
  const { pending, act } = useAct()
  return (
    <form className="space-y-3" onSubmit={(e) => {
      e.preventDefault()
      const fd = new FormData(e.currentTarget)
      act(() => changePasswordAction(String(fd.get("current")), String(fd.get("next")), String(fd.get("confirm"))), "Password changed — please sign in again", () => router.push("/login"))
    }}>
      <div className="space-y-1.5"><Label htmlFor="current">Current password</Label><Input id="current" name="current" type="password" autoComplete="current-password" required /></div>
      <div className="space-y-1.5"><Label htmlFor="next">New password</Label><Input id="next" name="next" type="password" minLength={10} autoComplete="new-password" required /></div>
      <div className="space-y-1.5"><Label htmlFor="confirm">Confirm new password</Label><Input id="confirm" name="confirm" type="password" minLength={10} autoComplete="new-password" required /></div>
      <Button loading={pending}>Change password</Button>
    </form>
  )
}

export function ThemeChoice() {
  const { theme, setTheme } = useTheme()
  return (
    <div role="radiogroup" aria-label="Theme" className="flex gap-2">
      {(["light", "dark", "system"] as const).map((t) => (
        <Button key={t} role="radio" aria-checked={theme === t} variant={theme === t ? "default" : "outline"} className="capitalize"
          onClick={() => { setTheme(t); void saveThemePref(t) }}>{t}</Button>
      ))}
    </div>
  )
}
