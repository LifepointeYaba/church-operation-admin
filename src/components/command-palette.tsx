"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { CornerDownLeft, Search, UserRound } from "lucide-react"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from "@/components/ui/command"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { displayPhone } from "@/lib/phone"
import { searchMembersAction } from "@/app/(app)/members/actions"
import type { Permission } from "@/lib/permissions"
import { useNav } from "./app-sidebar"
import { useCan } from "./permissions"
import { StatusBadge } from "./common"

/** Extra shortcuts shown alongside the pages. */
const QUICK: { href: string; label: string; keywords: string; perm?: Permission }[] = [
  { href: "/members?tab=fix", label: "Members needing fixes", keywords: "missing phone gender flags", perm: "members.edit" },
  { href: "/members?tab=deleted", label: "Recently deleted members", keywords: "restore trash", perm: "members.delete" },
  { href: "/uploads#review", label: "Review unmatched people", keywords: "pending approval merge", perm: "imports.manage" },
  { href: "/call-lists#review", label: "Status suggestions", keywords: "review approve", perm: "callLists.manage" },
  { href: "/account#password", label: "Change password", keywords: "account security" },
  { href: "/account", label: "My account", keywords: "profile name theme role" },
]

function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

/** ⌘K / Ctrl+K: jump to any page or find a member by name, phone or ID. */
export function CommandPalette() {
  const router = useRouter()
  const can = useCan()
  const nav = useNav()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const term = useDebounced(q.trim())

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
      // "/" opens search unless the person is typing somewhere.
      const el = e.target as HTMLElement | null
      if (e.key === "/" && !open && !(el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)))) {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  const members = useQuery({
    queryKey: ["palette-members", term],
    queryFn: () => searchMembersAction(term, 8),
    enabled: open && term.length >= 2 && can("members.view"),
  })

  const needle = q.trim().toLowerCase()
  const pages = nav.flatMap((g) => g.items.map((i) => ({ ...i, group: g.group })))
    .filter((p) => !needle || p.label.toLowerCase().includes(needle) || p.group.toLowerCase().includes(needle))
  const quick = QUICK.filter((x) => (!x.perm || can(x.perm)) && (!needle || `${x.label} ${x.keywords}`.toLowerCase().includes(needle)))

  const go = (href: string) => {
    setOpen(false)
    setQ("")
    router.push(href)
  }

  return (
    <>
      <Button
        variant="outline"
        className="ml-auto hidden h-9 w-full max-w-xs justify-start gap-2 px-3 font-normal text-muted-foreground md:flex"
        onClick={() => setOpen(true)}
        aria-label="Search members and pages"
        aria-keyshortcuts="Control+K Meta+K"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Search members or pages…</span>
        <kbd className="pointer-events-none rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">⌘K</kbd>
      </Button>
      <Button variant="ghost" size="icon" className="ml-auto md:hidden" onClick={() => setOpen(true)} aria-label="Search members and pages">
        <Search className="size-4" />
      </Button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ("") }}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-xl" showCloseButton={false}>
          <DialogTitle className="sr-only">Search</DialogTitle>
          <DialogDescription className="sr-only">Find a member by name, phone or ID, or jump to a page.</DialogDescription>
          <Command shouldFilter={false} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-item]]:py-2.5">
            <CommandInput value={q} onValueChange={setQ} placeholder="Type a name, phone number, ID or page…" className="h-12" />
            <CommandList className="max-h-[min(60vh,440px)]">
              {term.length >= 2 && (
                <CommandGroup heading="Members">
                  {members.isFetching && Array.from({ length: 3 }, (_, i) => (
                    <div key={i} className="flex items-center gap-3 px-2 py-2.5" aria-hidden>
                      <Skeleton className="size-7 rounded-full" />
                      <div className="flex-1 space-y-1.5"><Skeleton className="h-3.5 w-40" /><Skeleton className="h-3 w-24" /></div>
                    </div>
                  ))}
                  {!members.isFetching && members.data?.map((m) => (
                    <CommandItem key={m.id} value={`member-${m.id}`} onSelect={() => go(`/members/${m.id}`)}>
                      <UserRound className="text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{m.firstName} {m.lastName}</div>
                        <div className="truncate text-xs text-muted-foreground">{displayPhone(m.phone) || "No phone"} · #{m.id}</div>
                      </div>
                      <StatusBadge status={m.status} />
                    </CommandItem>
                  ))}
                  {!members.isFetching && members.isSuccess && members.data.length === 0 && (
                    <p className="px-2 py-3 text-sm text-muted-foreground">No members match “{term}”.</p>
                  )}
                </CommandGroup>
              )}
              {pages.length > 0 && (
                <CommandGroup heading="Go to">
                  {pages.map((p) => (
                    <CommandItem key={p.href} value={`page-${p.href}`} onSelect={() => go(p.href)}>
                      <p.icon className="text-muted-foreground" />
                      <span className="flex-1">{p.label}</span>
                      <CommandShortcut>{p.group}</CommandShortcut>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {quick.length > 0 && (
                <CommandGroup heading="Shortcuts">
                  {quick.map((x) => (
                    <CommandItem key={x.href} value={`quick-${x.href}`} onSelect={() => go(x.href)}>
                      <CornerDownLeft className="text-muted-foreground" />
                      <span>{x.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {term.length < 2 && pages.length === 0 && quick.length === 0 && <CommandEmpty>No pages match.</CommandEmpty>}
            </CommandList>
            <div className="flex items-center gap-3 border-t px-3 py-2 text-xs text-muted-foreground">
              <span><kbd className="rounded border bg-muted px-1 font-mono">↑↓</kbd> move</span>
              <span><kbd className="rounded border bg-muted px-1 font-mono">↵</kbd> open</span>
              <span><kbd className="rounded border bg-muted px-1 font-mono">esc</kbd> close</span>
              <span className="ml-auto">Tip: press <kbd className="rounded border bg-muted px-1 font-mono">/</kbd> anywhere</span>
            </div>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  )
}
