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
  "First Timer": "bg-ember-soft text-ember-text",
  "Second Timer": "bg-ember-soft text-bark dark:text-bark",
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
  blue: "bg-primary-soft text-primary",
  green: "bg-primary-soft text-primary",
  amber: "bg-warning-soft text-warning",
  violet: "bg-ember-soft text-ember-text",
} as const

export function StatCard({ label, value, delta, icon: Icon, hint, tone = "blue" }: {
  label: string; value: number; delta?: number | null; icon?: LucideIcon; hint?: string; tone?: keyof typeof TONES
}) {
  return (
    <Card className="hover-lift gap-0 py-4">
      <CardContent className="px-4">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
          {Icon && (
            <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", TONES[tone])}>
              <Icon className="size-[18px]" aria-hidden />
            </span>
          )}
        </div>
        <div className="mt-1 font-display text-3xl font-bold tabular-nums"><CountUp value={value} /></div>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {delta != null && (
            <span className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium tabular-nums",
              delta > 0 ? "bg-status-good/12 text-status-good" : delta < 0 ? "bg-status-bad/12 text-status-bad" : "bg-muted",
            )}>
              {delta > 0 ? "▲" : delta < 0 ? "▼" : "•"} {Math.abs(delta)}
            </span>
          )}
          {delta != null && <span>vs last Sunday</span>}
        </div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
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
