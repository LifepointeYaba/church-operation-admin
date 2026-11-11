"use client"

import { useEffect, useState } from "react"
import { Check, Copy, KeyRound, Pencil, Trash2, UserPlus } from "lucide-react"
import { useActionMutation, useRunAction } from "@/hooks/use-action-mutation"
import { useConfirm } from "@/components/confirm-dialog"
import { notify } from "@/components/notifications"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SelectField } from "@/components/select-field"
import { ROLES, roleLabel, type Role } from "@/lib/permissions"
import { TEMP_PASSWORD_MINUTES } from "@/lib/password-rules"
import { createUserAction, deleteUserAction, regeneratePasswordAction, updateUserAction } from "./actions"

const when = (iso: string, withTime = false) =>
  new Date(iso).toLocaleString("en-GB", { timeZone: "Africa/Lagos", dateStyle: "medium", ...(withTime ? { timeStyle: "short" } : {}) })

export type UserRow = {
  id: string
  name: string | null
  email: string
  role: string
  lastLogin: string | null
  createdAt: string
  createdBy: string | null
  mustChangePassword: boolean
  tempPasswordExpiresAt: string | null
  locked: boolean
  isMe: boolean
  manageable: boolean
}

type Issued = { email: string; password: string; expiresAt: string }

/** Re-renders every `ms` so countdowns stay current. */
function useNow(ms = 15_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

const minutesLeft = (iso: string, now: number) => Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 60_000))

function RoleSelect({ roles, value, onChange, id }: { roles: Role[]; value: string; onChange: (r: string) => void; id?: string }) {
  return (
    <SelectField id={id} aria-label="Role" value={value} onChange={(e) => onChange(e.target.value)} className="w-full">
      {roles.map((r) => <option key={r} value={r}>{ROLES[r].label}</option>)}
    </SelectField>
  )
}

/** Shows a just-generated password once, with copy and a live expiry countdown. */
function PasswordReveal({ issued, onClose }: { issued: Issued | null; onClose: () => void }) {
  const now = useNow(1_000)
  const [copied, setCopied] = useState(false)
  useEffect(() => setCopied(false), [issued])
  const left = issued ? minutesLeft(issued.expiresAt, now) : 0
  const copy = async () => {
    if (!issued) return
    try {
      await navigator.clipboard.writeText(issued.password)
      setCopied(true)
    } catch {
      notify.error("Couldn’t copy. Select the password and copy it by hand.")
    }
  }
  return (
    <Dialog open={!!issued} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Temporary password</DialogTitle>
          <DialogDescription>Give this to <span className="font-medium text-foreground">{issued?.email}</span>. They’ll choose their own password when they first sign in.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <Input readOnly value={issued?.password ?? ""} className="h-11 font-mono text-lg tracking-wider" onFocus={(e) => e.currentTarget.select()} aria-label="Temporary password" />
          <Button size="icon" variant="outline" className="size-11 shrink-0" onClick={copy} aria-label="Copy password">
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </Button>
        </div>
        <Alert>
          <AlertDescription>
            {left > 0
              ? <>Works for <span className="font-semibold">{left} more {left === 1 ? "minute" : "minutes"}</span>. It won’t be shown again — if it’s lost or expires, generate a new one.</>
              : <>This password has expired. Generate a new one.</>}
          </AlertDescription>
        </Alert>
        <DialogFooter><Button onClick={onClose}>Done</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AddUserButton({ roles }: { roles: Role[] }) {
  const [open, setOpen] = useState(false)
  const [issued, setIssued] = useState<Issued | null>(null)
  const [v, setV] = useState<{ name: string; email: string; role: string }>({ name: "", email: "", role: roles.includes("viewer") ? "viewer" : roles[0] })
  const create = useActionMutation(createUserAction, {
    success: "User added",
    onSuccess: (r) => { setOpen(false); setIssued(r.data); setV({ ...v, name: "", email: "" }) },
  })
  return (
    <>
      <Button onClick={() => setOpen(true)}><UserPlus className="size-4" /> Add user</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add user</DialogTitle><DialogDescription>We’ll generate a temporary password for you to pass on. No email is sent.</DialogDescription></DialogHeader>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); create.mutate(v) }}>
            <div className="space-y-1.5"><Label htmlFor="new-name">Name</Label><Input id="new-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} maxLength={80} autoFocus /></div>
            <div className="space-y-1.5"><Label htmlFor="new-email">Email</Label><Input id="new-email" type="email" required value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></div>
            <div className="space-y-1.5">
              <Label htmlFor="new-role">Role</Label>
              <RoleSelect id="new-role" roles={roles} value={v.role} onChange={(role) => setV({ ...v, role })} />
              <p className="text-xs text-muted-foreground">{ROLES[v.role as Role]?.description}</p>
            </div>
            <DialogFooter><Button loading={create.isPending}>Add and generate password</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <PasswordReveal issued={issued} onClose={() => setIssued(null)} />
    </>
  )
}

function EditUserDialog({ user, roles, onClose }: { user: UserRow | null; roles: Role[]; onClose: () => void }) {
  const [v, setV] = useState({ name: "", role: "" })
  useEffect(() => { if (user) setV({ name: user.name ?? "", role: user.role }) }, [user])
  const save = useActionMutation((x: typeof v) => updateUserAction(user!.id, x), { success: "User updated", onSuccess: onClose })
  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Edit user</DialogTitle><DialogDescription>{user?.email}</DialogDescription></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(v) }}>
          <div className="space-y-1.5"><Label htmlFor="edit-name">Name</Label><Input id="edit-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} maxLength={80} /></div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-role">Role</Label>
            <RoleSelect id="edit-role" roles={roles} value={v.role} onChange={(role) => setV({ ...v, role })} />
            <p className="text-xs text-muted-foreground">{ROLES[v.role as Role]?.description}</p>
          </div>
          <DialogFooter><Button loading={save.isPending}>Save</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function StatusBadge({ u, now }: { u: UserRow; now: number }) {
  if (u.locked) return <Badge variant="destructive">Locked</Badge>
  if (u.mustChangePassword) {
    const left = u.tempPasswordExpiresAt ? minutesLeft(u.tempPasswordExpiresAt, now) : 0
    return left > 0
      ? <Badge variant="secondary">Temp password · {left} min left</Badge>
      : <Badge variant="outline" className="border-destructive/50 text-destructive">Temp password expired</Badge>
  }
  return u.lastLogin ? <Badge variant="outline">Active</Badge> : <Badge variant="outline">Never signed in</Badge>
}

export function UsersTable({ rows, roles }: { rows: UserRow[]; roles: Role[] }) {
  const now = useNow()
  const confirm = useConfirm()
  const [editing, setEditing] = useState<UserRow | null>(null)
  const [issued, setIssued] = useState<Issued | null>(null)
  const { run, isPending } = useRunAction()
  const regen = useActionMutation(regeneratePasswordAction, { success: "New password generated", onSuccess: (r) => setIssued(r.data) })
  const busy = isPending || regen.isPending
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">User</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last sign-in</TableHead>
            <TableHead>Added</TableHead>
            <TableHead className="pr-4"><span className="sr-only">Actions</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((u) => (
            <TableRow key={u.id}>
              <TableCell className="pl-4">
                <div className="font-medium">{u.name || u.email}{u.isMe && <span className="text-muted-foreground"> (you)</span>}</div>
                {u.name && <div className="text-xs text-muted-foreground">{u.email}</div>}
              </TableCell>
              <TableCell className="whitespace-nowrap">{roleLabel(u.role)}</TableCell>
              <TableCell><StatusBadge u={u} now={now} /></TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">{u.lastLogin ? when(u.lastLogin, true) : "—"}</TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {when(u.createdAt)}
                {u.createdBy && <div className="text-xs">by {u.createdBy}</div>}
              </TableCell>
              <TableCell className="pr-4 text-right">
                {u.manageable && (
                  <span className="inline-flex">
                    <Button size="icon" variant="ghost" aria-label={`Edit ${u.email}`} disabled={busy} onClick={() => setEditing(u)}><Pencil className="size-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label={`Generate a new password for ${u.email}`} disabled={busy}
                      onClick={async () => {
                        const ok = await confirm({
                          title: `New password for ${u.name || u.email}?`,
                          description: `Their current password stops working and they’re signed out. The new one works for ${TEMP_PASSWORD_MINUTES} minutes and they’ll choose their own on sign-in.`,
                          confirmLabel: "Generate password",
                        })
                        if (ok) regen.mutate(u.id)
                      }}>
                      <KeyRound className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" aria-label={`Remove ${u.email}`} disabled={busy}
                      onClick={async () => {
                        const ok = await confirm({
                          title: `Remove ${u.name || u.email}?`,
                          description: "They lose access immediately. Their past actions stay in the audit log.",
                          confirmLabel: "Remove user", destructive: true,
                        })
                        if (ok) run(() => deleteUserAction(u.id), "User removed")
                      }}>
                      <Trash2 className="size-4" />
                    </Button>
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <EditUserDialog user={editing} roles={roles} onClose={() => setEditing(null)} />
      <PasswordReveal issued={issued} onClose={() => setIssued(null)} />
    </div>
  )
}
