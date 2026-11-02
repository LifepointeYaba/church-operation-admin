"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ArrowLeft, KeyRound, LogOut, Search, UserRound } from "lucide-react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ThemeToggle } from "./theme-toggle"
import { NAV } from "./app-sidebar"
import { logoutAction } from "@/app/(app)/actions"

export function TopBar({ email, themePref }: { email: string; themePref: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const [q, setQ] = useState("")
  const title =
    NAV.flatMap((g) => g.items)
      .filter((i) => pathname === i.href || pathname.startsWith(i.href + "/"))
      .sort((a, b) => b.href.length - a.href.length)[0]?.label ??
    (pathname.startsWith("/members/") ? "Member profile" : "")
  // Sub-pages (e.g. /members/12, /settings/audit) get a back button.
  const parent = pathname.split("/").filter(Boolean).length > 1 ? pathname.slice(0, pathname.lastIndexOf("/")) : null
  const parentLabel = parent ? NAV.flatMap((g) => g.items).find((i) => i.href === parent)?.label ?? "Back" : null
  // Count in-app page changes so Back returns to where the user came from; on a fresh load it goes to the parent page.
  const moves = useRef(-1)
  useEffect(() => { moves.current++ }, [pathname])
  const goBack = () => (moves.current > 0 ? router.back() : router.push(parent!))
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur-md supports-[backdrop-filter]:bg-background/65 md:px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 h-4" />
      {parent && (
        <Button variant="ghost" size="sm" className="-ml-1 gap-1 px-2" onClick={goBack} aria-label={`Back to ${parentLabel}`}>
          <ArrowLeft className="size-4" /><span className="hidden sm:inline">{parentLabel}</span>
        </Button>
      )}
      <h1 className="truncate text-sm font-medium md:text-base">{title}</h1>
      <form
        className="ml-auto hidden w-full max-w-xs md:block"
        onSubmit={(e) => {
          e.preventDefault()
          if (q.trim()) router.push(`/members?q=${encodeURIComponent(q.trim())}`)
        }}
        role="search"
      >
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or phone…" className="pl-8" aria-label="Search members" />
        </div>
      </form>
      <Button variant="ghost" size="icon" className="ml-auto md:hidden" asChild aria-label="Search members">
        <Link href="/members"><Search className="size-4" /></Link>
      </Button>
      <ThemeToggle accountPref={themePref} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Account"><UserRound className="size-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/settings#password"><KeyRound className="size-4" /> Change password</Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void logoutAction()}>
            <LogOut className="size-4" /> Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
