"use client"

import { useActionState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { completeReset, requestReset, type ResetState } from "./actions"

function Feedback({ state }: { state: ResetState }) {
  if (state.error)
    return (
      <Alert variant="destructive">
        <AlertDescription>{state.error}</AlertDescription>
      </Alert>
    )
  if (state.message)
    return (
      <Alert>
        <AlertDescription>{state.message}</AlertDescription>
      </Alert>
    )
  return null
}

export function RequestResetForm() {
  const [state, action, pending] = useActionState<ResetState, FormData>(requestReset, {})
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset password</CardTitle>
        <CardDescription>We will email a one-time link to the Super Admin address.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <Feedback state={state} />
          <Button className="h-10 w-full" disabled={pending}>Send reset link</Button>
          <Link href="/login" className="block text-center text-sm text-primary hover:underline">Back to sign in</Link>
        </form>
      </CardContent>
    </Card>
  )
}

export function NewPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<ResetState, FormData>(completeReset, {})
  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose a new password</CardTitle>
        <CardDescription>At least 10 characters.</CardDescription>
      </CardHeader>
      <CardContent>
        {state.done ? (
          <div className="space-y-4">
            <Feedback state={state} />
            <Button asChild className="h-10 w-full"><Link href="/login">Sign in</Link></Button>
          </div>
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="token" value={token} />
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input id="password" name="password" type="password" minLength={10} autoComplete="new-password" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input id="confirm" name="confirm" type="password" minLength={10} autoComplete="new-password" required />
            </div>
            <Feedback state={state} />
            <Button className="h-10 w-full" disabled={pending}>Update password</Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
