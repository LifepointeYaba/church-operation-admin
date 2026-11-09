"use client"

import { useEffect, useSyncExternalStore } from "react"
import { CircleCheck, CircleX, Info, TriangleAlert, X } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { cn } from "@/lib/utils"

export type NotificationKind = "success" | "error" | "warning" | "info"
type Notification = { id: number; kind: NotificationKind; title: string; description?: string; duration: number }
type Options = { description?: string; duration?: number }

/** How long each kind stays on screen. Errors stay longer so they can be read. */
const DURATION: Record<NotificationKind, number> = { success: 4000, info: 5000, warning: 7000, error: 9000 }

// A tiny external store so any client code (hooks, handlers, mutations) can raise a notification.
let items: Notification[] = []
let nextId = 1
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

function push(kind: NotificationKind, title: string, opts: Options = {}) {
  const n: Notification = { id: nextId++, kind, title, description: opts.description, duration: opts.duration ?? DURATION[kind] }
  // Same message twice in a row (e.g. double click) → replace rather than stack.
  items = [...items.filter((i) => !(i.kind === kind && i.title === title)), n].slice(-4)
  emit()
  return n.id
}

export function dismiss(id: number) {
  items = items.filter((i) => i.id !== id)
  emit()
}

/** Raise a notification. Same shape as the old toast API: `notify.success("Saved", { description })`. */
export const notify = {
  success: (title: string, opts?: Options) => push("success", title, opts),
  error: (title: string, opts?: Options) => push("error", title, opts),
  warning: (title: string, opts?: Options) => push("warning", title, opts),
  info: (title: string, opts?: Options) => push("info", title, opts),
}
/** Alias kept so existing `toast.success(...)` calls read naturally. */
export const toast = notify

const STYLE: Record<NotificationKind, { icon: typeof Info; className: string; label: string }> = {
  success: { icon: CircleCheck, label: "Success", className: "border-status-good/40 [&>svg]:text-status-good" },
  error: { icon: CircleX, label: "Something went wrong", className: "border-destructive/50 [&>svg]:text-destructive" },
  warning: { icon: TriangleAlert, label: "Heads up", className: "border-status-warn/50 [&>svg]:text-status-warn" },
  info: { icon: Info, label: "Note", className: "border-primary/40 [&>svg]:text-primary" },
}

function NotificationItem({ n }: { n: Notification }) {
  useEffect(() => {
    const t = setTimeout(() => dismiss(n.id), n.duration)
    return () => clearTimeout(t)
  }, [n.id, n.duration])
  const { icon: Icon, className, label } = STYLE[n.kind]
  return (
    <Alert
      role={n.kind === "error" ? "alert" : "status"}
      className={cn("animate-fade-up pointer-events-auto pr-10 shadow-lg", className)}
    >
      <Icon aria-hidden />
      <AlertTitle className="line-clamp-2">
        <span className="sr-only">{label}: </span>{n.title}
      </AlertTitle>
      {n.description && <AlertDescription>{n.description}</AlertDescription>}
      <button
        type="button"
        onClick={() => dismiss(n.id)}
        className="absolute top-2.5 right-2.5 rounded-sm p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-label="Dismiss notification"
      >
        <X className="size-4" />
      </button>
    </Alert>
  )
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
const snapshot = () => items
const serverSnapshot: Notification[] = []

/** Renders the notification stack. Mount once, in the root layout. */
export function Notifications() {
  const list = useSyncExternalStore(subscribe, snapshot, () => serverSnapshot)
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-3 z-[100] mx-auto flex w-full max-w-md flex-col gap-2 px-4 sm:top-4 sm:right-4 sm:left-auto sm:mx-0"
    >
      {list.map((n) => <NotificationItem key={n.id} n={n} />)}
    </div>
  )
}
