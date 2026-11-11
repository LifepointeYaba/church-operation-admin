"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { MIN_PASSWORD_LENGTH } from "@/lib/password-rules"
import { logoutAction } from "@/app/(app)/actions"
import { setOwnPasswordAction, type ChangeState } from "./actions"

export function SetPasswordForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState<ChangeState, FormData>(setOwnPasswordAction, {})
  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose your password</CardTitle>
        <CardDescription>You signed in with a temporary password. Pick your own to continue.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <input type="hidden" name="username" value={email} autoComplete="username" />
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input id="password" name="password" type="password" minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" required autoFocus />
            <p className="text-xs text-muted-foreground">At least {MIN_PASSWORD_LENGTH} characters.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm new password</Label>
            <Input id="confirm" name="confirm" type="password" minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" required />
          </div>
          {state.error && (
            <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert>
          )}
          <Button type="submit" className="h-10 w-full" loading={pending}>{pending ? "Saving…" : "Save and continue"}</Button>
          <Button type="button" variant="ghost" className="w-full" onClick={() => void logoutAction()}>Sign out</Button>
        </form>
      </CardContent>
    </Card>
  )
}
