"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { Check, UserPlus } from "lucide-react"
import { toast } from "@/components/notifications"
import { useActionMutation } from "@/hooks/use-action-mutation"
import { useNavigation } from "@/components/navigation"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { SelectField } from "@/components/select-field"
import { shortStatus } from "@/components/common"
import { displayPhone } from "@/lib/phone"
import { formatDate } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { MemberForm, EMPTY_MEMBER } from "../members/member-form"
import { ensureServiceAction, setRecordTakenAction, toggleAttendanceAction } from "./actions"

type M = { id: number; name: string; phone: string | null; status: string }

export function MarkAttendance({ date, dates, serviceId: initialServiceId, recordTaken, members, initialPresent, statuses }: {
  date: string; dates: string[]; serviceId: number | null; recordTaken: boolean; members: M[]; initialPresent: number[]; statuses: string[]
}) {
  const router = useRouter()
  const [serviceId, setServiceId] = useState(initialServiceId)
  const nav = useNavigation()
  // Ticks show immediately; a failed save puts the tick back and raises an alert.
  const [present, setPresent] = useState(() => new Set(initialPresent))
  const optimistic = present
  const setOne = (id: number, on: boolean) => setPresent((s) => {
    const n = new Set(s)
    if (on) n.add(id)
    else n.delete(id)
    return n
  })
  const [q, setQ] = useState("")
  const [onlyPresent, setOnlyPresent] = useState(false)
  const [noRecord, setNoRecord] = useState(!recordTaken)
  const [addOpen, setAddOpen] = useState(false)

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const digits = needle.replace(/\D/g, "").replace(/^0/, "")
    return members.filter((m) => {
      if (onlyPresent && !optimistic.has(m.id)) return false
      if (!needle) return true
      return m.name.toLowerCase().includes(needle) || (digits.length >= 3 && (m.phone ?? "").includes(digits))
    })
  }, [members, q, onlyPresent, optimistic])

  const getService = useCallback(async () => {
    if (serviceId) return serviceId
    const r = await ensureServiceAction(date)
    if (!r.ok) {
      toast.error(r.error)
      return null
    }
    setServiceId(r.id)
    return r.id
  }, [serviceId, date])

  const toggleMutation = useMutation({
    mutationFn: async ({ m, on }: { m: M; on: boolean }) => {
      const sid = await getService()
      if (!sid) throw new Error("no-service")
      await toggleAttendanceAction(sid, m.id, on)
    },
    onMutate: ({ m, on }) => setOne(m.id, on),
    onSuccess: (_d, { on }) => { if (on && noRecord) setNoRecord(false) },
    onError: (err, { m, on }) => {
      setOne(m.id, !on)
      if (err.message !== "no-service") toast.error(`Couldn’t save ${m.name}`, { description: "Check your connection and try again." })
    },
  })
  const toggle = (m: M) => toggleMutation.mutate({ m, on: !optimistic.has(m.id) })

  const recordMutation = useActionMutation(
    async (noRecordTaken: boolean) => {
      const sid = await getService()
      if (!sid) return { ok: false as const, error: "Couldn’t prepare this Sunday" }
      return setRecordTakenAction(sid, !noRecordTaken)
    },
    {
      success: (_r, v) => v ? { title: "Marked as no record taken", description: "This Sunday is left out of trends." } : "Marked as record taken",
      onSuccess: (_r, v) => setNoRecord(v),
    },
  )

  return (
    <div className="mx-auto max-w-2xl space-y-3 pb-24">
      <div className="sticky top-14 z-10 -mx-3 space-y-2 border-b bg-background/95 px-3 pt-1 pb-3 backdrop-blur md:static md:mx-0 md:border-0 md:px-0">
        <div className="flex items-center gap-2">
          <SelectField aria-label="Sunday" value={date} onChange={(e) => nav.push(`/attendance?date=${e.target.value}`)} className="h-11 flex-1 text-base">
            {dates.map((d) => <option key={d} value={d}>{formatDate(d, "long")}</option>)}
          </SelectField>
          <div className="rounded-lg bg-primary px-3 py-2 text-center text-primary-foreground" aria-live="polite">
            <div className="text-xl leading-none font-semibold tabular-nums">{optimistic.size}</div>
            <div className="text-[10px] uppercase">present</div>
          </div>
        </div>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or phone…"
          className="h-11 text-base"
          inputMode="search"
          aria-label="Search people"
        />
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-2">
            <Switch id="only" checked={onlyPresent} onCheckedChange={setOnlyPresent} />
            <Label htmlFor="only">Present only</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="norecord"
              checked={noRecord}
              disabled={recordMutation.isPending}
              onCheckedChange={(v) => recordMutation.mutate(v)}
            />
            <Label htmlFor="norecord">No record taken</Label>
          </div>
        </div>
      </div>

      {nav.isPending ? (
        <div className="divide-y rounded-lg border" aria-hidden>
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex min-h-14 items-center gap-3 px-3 py-2">
              <Skeleton className="size-8 rounded-full" />
              <div className="flex-1 space-y-1.5"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-1/3" /></div>
            </div>
          ))}
        </div>
      ) : (
      <ul className="divide-y rounded-lg border">
        {list.slice(0, 300).map((m) => {
          const on = optimistic.has(m.id)
          return (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => toggle(m)}
                aria-pressed={on}
                className={cn("flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left transition-colors active:bg-muted", on && "bg-primary/10")}
              >
                <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full border-2", on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40")}>
                  {on && <Check className="size-5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{m.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{displayPhone(m.phone) || "No phone"} · {shortStatus(m.status)}</span>
                </span>
              </button>
            </li>
          )
        })}
        {list.length === 0 && (
          <li className="p-6 text-center text-sm text-muted-foreground">
            No one matches “{q}”.
            <Button className="mt-3 w-full" onClick={() => setAddOpen(true)}><UserPlus className="size-4" /> Add as first timer</Button>
          </li>
        )}
        {list.length > 300 && <li className="p-3 text-center text-sm text-muted-foreground">Showing 300 of {list.length}. Type to narrow down.</li>}
      </ul>
      )}

      <Button size="lg" className="fixed right-4 bottom-4 z-20 h-12 shadow-lg md:right-8" onClick={() => setAddOpen(true)}>
        <UserPlus className="size-5" /> Quick add
      </Button>

      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent side="bottom" className="max-h-[90svh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Quick-add first timer</SheetTitle>
            <SheetDescription>They will be marked present for {formatDate(date, "long")}.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <QuickAdd
              statuses={statuses}
              name={q}
              getService={getService}
              onAdded={(id) => { setAddOpen(false); setQ(""); setPresent((p) => new Set(p).add(id)); router.refresh() }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function QuickAdd({ statuses, name, getService, onAdded }: { statuses: string[]; name: string; getService: () => Promise<number | null>; onAdded: (id: number) => void }) {
  const [sid, setSid] = useState<number | null>(null)
  useEffect(() => {
    void getService().then(setSid)
  }, [getService])
  if (!sid) return (
    <div className="space-y-3" aria-busy="true" aria-label="Preparing">
      <div className="grid gap-3 sm:grid-cols-2">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-14" />)}</div>
      <Skeleton className="h-10 w-40" />
    </div>
  )
  const looksLikePhone = /^[\d\s+]+$/.test(name.trim())
  const [first, ...rest] = looksLikePhone ? [""] : name.trim().split(/\s+/)
  return (
    <MemberForm
      compact
      statuses={statuses}
      presentAt={sid}
      initial={{ ...EMPTY_MEMBER, firstName: first ?? "", lastName: rest.join(" "), phone: looksLikePhone ? name.trim() : "" }}
      onDone={onAdded}
    />
  )
}
