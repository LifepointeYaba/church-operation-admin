"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, TriangleAlert } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { NativeSelect } from "@/components/native-select"
import { displayPhone } from "@/lib/phone"
import type { MemberInput } from "@/lib/members"
import { checkDuplicatesAction, createMemberAction, mergeAction, updateMemberAction } from "./actions"

type Dup = Awaited<ReturnType<typeof checkDuplicatesAction>>

export const EMPTY_MEMBER: Required<MemberInput> = {
  firstName: "", lastName: "", phone: "", altPhone: "", email: "", address: "", gender: "",
  status: "First Timer", branch: "Main", personResponsible: "", notes: "",
}

export function MemberForm({
  initial = EMPTY_MEMBER, memberId, statuses, presentAt, compact, onDone,
}: {
  initial?: Required<MemberInput>
  memberId?: number
  statuses: string[]
  /** When set (quick-add), the new person is marked present at this service. */
  presentAt?: number
  compact?: boolean
  onDone?: (id: number) => void
}) {
  const router = useRouter()
  const [v, setV] = useState(initial)
  const [dup, setDup] = useState<Dup | null>(null)
  const [error, setError] = useState<{ msg: string; clashId?: number } | null>(null)
  const [pending, start] = useTransition()
  const set = (k: keyof MemberInput) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value })

  useEffect(() => {
    if (!v.firstName.trim() && !v.phone.trim()) return setDup(null)
    const t = setTimeout(async () => setDup(await checkDuplicatesAction(v.firstName, v.lastName, v.phone, memberId)), 350)
    return () => clearTimeout(t)
  }, [v.firstName, v.lastName, v.phone, memberId])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    start(async () => {
      const res = memberId ? await updateMemberAction(memberId, v) : await createMemberAction(v, presentAt)
      if (!res.ok) return setError({ msg: res.error, clashId: res.clashId })
      toast.success(memberId ? "Saved" : presentAt ? "Added and marked present" : "Member added")
      router.refresh()
      onDone?.(res.data as number)
    })
  }

  const merge = (otherId: number) =>
    start(async () => {
      if (!memberId) return
      const res = await mergeAction(otherId, memberId)
      if (!res.ok) { toast.error(res.error); return }
      toast.success("Records merged")
      router.push(`/members/${otherId}`)
    })

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="First name" required><Input value={v.firstName} onChange={set("firstName")} required autoFocus={!memberId} /></Field>
        <Field label="Last name"><Input value={v.lastName} onChange={set("lastName")} /></Field>
        <Field label="Phone" required={!memberId}>
          <Input value={v.phone} onChange={set("phone")} inputMode="tel" placeholder="0803 123 4567" required={!memberId} />
        </Field>
        <Field label="Gender">
          <NativeSelect value={v.gender} onChange={set("gender")} className="w-full">
            <option value="">Not set</option><option>Female</option><option>Male</option>
          </NativeSelect>
        </Field>
        {!compact && (
          <>
            <Field label="Status">
              <NativeSelect value={v.status} onChange={set("status")} className="w-full">
                {statuses.map((s) => <option key={s}>{s}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Email"><Input type="email" value={v.email} onChange={set("email")} /></Field>
            <Field label="Alternative phone"><Input value={v.altPhone} onChange={set("altPhone")} inputMode="tel" /></Field>
            <Field label="Person responsible"><Input value={v.personResponsible} onChange={set("personResponsible")} /></Field>
            <Field label="Address" wide><Input value={v.address} onChange={set("address")} /></Field>
            <Field label="Branch"><Input value={v.branch} onChange={set("branch")} /></Field>
            <Field label="Notes" wide><Textarea value={v.notes} onChange={set("notes")} rows={2} /></Field>
          </>
        )}
      </div>

      {dup?.exact && (
        <Alert variant="destructive">
          <TriangleAlert className="size-4" />
          <AlertDescription>
            <span>
              Already registered:{" "}
              <Link className="underline" href={`/members/${dup.exact.id}`}>{dup.exact.firstName} {dup.exact.lastName}</Link>{" "}
              ({displayPhone(dup.exact.phone)})
            </span>
            {memberId && <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => merge(dup.exact!.id)}>Merge into that record</Button>}
          </AlertDescription>
        </Alert>
      )}
      {!dup?.exact && dup?.similar.length ? (
        <Alert>
          <AlertDescription>
            <span className="font-medium">Similar records:</span>
            <ul className="mt-1 space-y-0.5">
              {dup.similar.slice(0, 5).map((s) => (
                <li key={s.id}>
                  <Link href={`/members/${s.id}`} className="underline">{s.firstName} {s.lastName}</Link>{" "}
                  <span className="text-muted-foreground">{displayPhone(s.phone)} · {s.status}</span>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {error.msg}
            {error.clashId && memberId && (
              <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => merge(error.clashId!)}>Merge into #{error.clashId}</Button>
            )}
          </AlertDescription>
        </Alert>
      )}
      <Button type="submit" className="h-10 w-full sm:w-auto" disabled={pending || (!memberId && !!dup?.exact)}>
        {pending ? "Saving…" : memberId ? "Save changes" : presentAt ? "Add and mark present" : "Add member"}
      </Button>
    </form>
  )
}

function Field({ label, children, required, wide }: { label: string; children: React.ReactNode; required?: boolean; wide?: boolean }) {
  return (
    <div className={wide ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
      <Label>{label}{required && <span className="text-destructive"> *</span>}</Label>
      {children}
    </div>
  )
}

export function AddMemberButton({ statuses }: { statuses: string[] }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="size-4" /> Add member</Button></DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add member</DialogTitle>
          <DialogDescription>Phone is required. We check name + phone for duplicates as you type.</DialogDescription>
        </DialogHeader>
        <MemberForm statuses={statuses} onDone={(id) => { setOpen(false); router.push(`/members/${id}`) }} />
      </DialogContent>
    </Dialog>
  )
}
