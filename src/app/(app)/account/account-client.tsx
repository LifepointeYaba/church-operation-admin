"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { useRunAction } from "@/hooks/use-action-mutation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MIN_PASSWORD_LENGTH } from "@/lib/password-rules"
import { saveThemePref } from "../actions"
import { changePasswordAction, updateProfileAction } from "./actions"

export function ProfileForm({ name }: { name: string }) {
  const { run, isPending } = useRunAction()
  const [v, setV] = useState(name)
  return (
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(() => updateProfileAction(v), "Name saved") }}>
      <Input aria-label="Your name" value={v} onChange={(e) => setV(e.target.value)} placeholder="Your name" maxLength={80} />
      <Button variant="secondary" loading={isPending} disabled={v.trim() === name}>Save</Button>
    </form>
  )
}

export function PasswordForm() {
  const router = useRouter()
  const { run, isPending } = useRunAction()
  return (
    <form className="space-y-3" onSubmit={(e) => {
      e.preventDefault()
      const fd = new FormData(e.currentTarget)
      run(() => changePasswordAction(String(fd.get("current")), String(fd.get("next")), String(fd.get("confirm"))), "Password changed — please sign in again", () => router.push("/login"))
    }}>
      <div className="space-y-1.5"><Label htmlFor="current">Current password</Label><Input id="current" name="current" type="password" autoComplete="current-password" required /></div>
      <div className="space-y-1.5"><Label htmlFor="next">New password</Label><Input id="next" name="next" type="password" minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" required /></div>
      <div className="space-y-1.5"><Label htmlFor="confirm">Confirm new password</Label><Input id="confirm" name="confirm" type="password" minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" required /></div>
      <Button loading={isPending}>Change password</Button>
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
