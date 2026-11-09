import type { LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { CountUp } from "./count-up"

export function PageHeader({ title, description, actions }: { title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-[28px] leading-[34px] font-bold">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

const STATUS_STYLE: Record<string, string> = {
  "First Timer": "bg-transparent text-ember-text ring-1 ring-primary",
  "Second Timer": "bg-surface-sunken text-bark ring-1 ring-bark/40 dark:text-bark",
  "Regular, not done membership class": "bg-warning-soft text-warning",
  Member: "bg-primary-soft text-primary",
  Worker: "bg-primary text-primary-foreground",
  "Member from other expressions": "bg-surface-sunken text-foreground ring-1 ring-border",
  "Not Active": "bg-surface-sunken text-muted-foreground",
}

export const shortStatus = (s: string) => (s === "Regular, not done membership class" ? "Regular (no class)" : s === "Member from other expressions" ? "Other expression" : s)

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="secondary" className={cn("border-0 font-medium whitespace-nowrap", STATUS_STYLE[status])} title={status}>
      {shortStatus(status)}
    </Badge>
  )
}

const ACT: Record<string, { label: string; cls: string }> = {
  active: { label: "Active", cls: "text-status-good" },
  at_risk: { label: "At risk", cls: "text-status-warn" },
  inactive: { label: "Inactive", cls: "text-status-bad" },
  lapsed: { label: "Lapsed", cls: "text-muted-foreground" },
  never: { label: "Never present", cls: "text-muted-foreground" },
}

export function ActivityLabel({ activity }: { activity: string }) {
  const a = ACT[activity] ?? ACT.never
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap", a.cls)}>
      <span className="size-2 rounded-full bg-current" aria-hidden />
      {a.label}
    </span>
  )
}

const TONES = {
  blue: "bg-muted text-foreground",
  green: "bg-muted text-foreground",
  amber: "bg-warning-soft text-warning",
  violet: "bg-primary-soft text-primary",
} as const

export function StatCard({ label, value, delta, icon: Icon, hint, tone = "blue", lowerIsBetter }: {
  label: string; value: number; delta?: number | null; icon?: LucideIcon; hint?: string; tone?: keyof typeof TONES; lowerIsBetter?: boolean
}) {
  const good = delta != null && delta !== 0 && (delta > 0) !== !!lowerIsBetter
  return (
    <Card className="gap-0 py-4">
      <CardContent className="flex items-center gap-3 px-4">
        {Icon && (
          <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-full", TONES[tone])}>
            <Icon className="size-5" aria-hidden />
          </span>
        )}
        <div className="min-w-0">
          <span className="block truncate text-sm font-semibold text-muted-foreground">{label}</span>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-display text-2xl font-bold tabular-nums"><CountUp value={value} /></span>
            {delta != null && (
              <span className={cn("text-xs font-bold whitespace-nowrap tabular-nums", delta === 0 ? "text-muted-foreground" : good ? "text-primary" : "text-destructive")}>
                {delta > 0 ? "▲" : delta < 0 ? "▼" : "•"} {delta > 0 ? "+" : ""}{delta}
                <span className="font-semibold text-muted-foreground"> vs last Sunday</span>
              </span>
            )}
          </div>
          {hint && <div className="truncate text-xs text-muted-foreground">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  )
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="animate-fade-up rounded-xl border border-dashed bg-card/50 p-10 text-center">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-1 text-sm text-muted-foreground">{children}</div>}
    </div>
  )
}

export const FLAG_LABELS: Record<string, string> = {
  needs_phone: "No phone",
  short_phone: "Short number",
  bad_phone: "Invalid number",
  needs_last_name: "No last name",
  needs_gender: "No gender",
  shared_phone: "Phone shared with someone else",
}
