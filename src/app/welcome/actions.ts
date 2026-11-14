"use server"

import { ZodError } from "zod"
import { submitFirstTimerForm, type FirstTimerInput } from "@/lib/first-timers"
import { refreshData } from "@/lib/revalidate"

/** Public (no sign-in): saves the first-timer form for the link's Sunday. */
export async function submitFirstTimerAction(token: string, input: FirstTimerInput) {
  try {
    const { firstName } = await submitFirstTimerForm(token, input)
    refreshData()
    return { ok: true as const, firstName }
  } catch (e) {
    const error = e instanceof ZodError
      ? e.issues[0]?.message ?? "Check the form and try again."
      : e instanceof Error ? e.message : "Something went wrong. Please try again."
    return { ok: false as const, error }
  }
}
