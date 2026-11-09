"use client"

import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { notify } from "@/components/notifications"

type Failed = { ok: false; error: string }
/** Server actions return `{ ok: true, … }` or `{ ok: false, error }` (sometimes typed loosely as `ok: boolean`). */
type ActionResult = { ok: boolean; error?: string }

type Success<R> = R extends { ok: false } ? never : R
type Failure<R> = R extends { ok: true } ? never : R & { error: string }
type Message<R, V> = string | { title: string; description?: string } | null | ((data: Success<R>, vars: V) => string | { title: string; description?: string } | null)

/** A server action said no (validation, not found…). Carries the full result for custom handling. */
export class ActionFailed<R> extends Error {
  constructor(public result: R & Failed) {
    super(result.error || "Something went wrong. Please try again.")
  }
}

const NETWORK_ERROR = "Couldn’t reach the server. Check your connection and try again."

/**
 * Run a server action (create/update/delete) through React Query.
 * Gives `isPending` for loading states, shows a success or failure alert,
 * and refreshes the page data afterwards.
 */
export function useActionMutation<V, R extends ActionResult>(
  action: (vars: V) => Promise<R>,
  opts: {
    success?: Message<R, V>
    /** Return true when the failure was handled (no error alert is shown). */
    onFailure?: (result: Failure<R>, vars: V) => boolean | void
    onSuccess?: (data: Success<R>, vars: V) => void
    /** Refresh server-rendered data after success (default true). */
    refresh?: boolean
  } = {},
) {
  const router = useRouter()
  return useMutation<Success<R>, Error, V>({
    mutationFn: async (vars) => {
      const result = await action(vars)
      if (!result.ok) throw new ActionFailed(result as unknown as R & Failed)
      return result as Success<R>
    },
    onSuccess: (data, vars) => {
      const msg = typeof opts.success === "function" ? opts.success(data, vars) : opts.success
      if (msg) {
        if (typeof msg === "string") notify.success(msg)
        else notify.success(msg.title, { description: msg.description })
      }
      opts.onSuccess?.(data, vars)
      if (opts.refresh !== false) router.refresh()
    },
    onError: (err, vars) => {
      if (err instanceof ActionFailed) {
        if (opts.onFailure?.(err.result as Failure<R>, vars)) return
        notify.error(err.message)
      } else {
        notify.error(NETWORK_ERROR)
      }
    },
  })
}

type Run = {
  fn: () => Promise<ActionResult>
  success?: string | { title: string; description?: string }
  after?: () => void
}

/**
 * For screens with many small actions: `run(() => deleteThing(id), "Deleted")`.
 * Same React Query mutation, loading state and alerts as useActionMutation.
 */
export function useRunAction(opts: { refresh?: boolean } = {}) {
  const m = useActionMutation((v: Run) => v.fn(), {
    success: (_data, v) => v.success ?? null,
    onSuccess: (_data, v) => v.after?.(),
    refresh: opts.refresh,
  })
  const run = (fn: Run["fn"], success?: Run["success"], after?: Run["after"]) => m.mutate({ fn, success, after })
  return { run, isPending: m.isPending, variables: m.variables }
}
