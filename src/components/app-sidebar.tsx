"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3, CalendarCheck, ClipboardList, FileClock, LayoutDashboard, PhoneCall, Settings, Upload, UserCog, Users,
  type LucideIcon,
} from "lucide-react"
import type { Permission } from "@/lib/permissions"
import { useCan } from "./permissions"
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu,
  SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarRail, useSidebar,
} from "@/components/ui/sidebar"

type NavItem = { href: string; label: string; icon: LucideIcon; perm: Permission }

export const NAV: { group: string; items: NavItem[] }[] = [
  { group: "Overview", items: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, perm: "dashboard.view" },
    { href: "/trends", label: "Trends", icon: BarChart3, perm: "dashboard.view" },
  ] },
  { group: "Sunday", items: [
    { href: "/attendance", label: "Mark attendance", icon: CalendarCheck, perm: "attendance.mark" },
    { href: "/headcount", label: "Weekly headcount", icon: ClipboardList, perm: "headcount.manage" },
    { href: "/call-lists", label: "Call lists", icon: PhoneCall, perm: "callLists.view" },
  ] },
  { group: "Records", items: [
    { href: "/members", label: "Members", icon: Users, perm: "members.view" },
    { href: "/uploads", label: "Uploads & import", icon: Upload, perm: "imports.manage" },
  ] },
  { group: "Admin", items: [
    { href: "/settings", label: "Settings", icon: Settings, perm: "settings.manage" },
    { href: "/users", label: "Users & roles", icon: UserCog, perm: "users.manage" },
    { href: "/settings/audit", label: "Audit log", icon: FileClock, perm: "audit.view" },
  ] },
]

/** Nav groups filtered to what the signed-in user's role can open. */
export function useNav() {
  const can = useCan()
  return NAV.map((g) => ({ ...g, items: g.items.filter((i) => can(i.perm)) })).filter((g) => g.items.length)
}

/** `badges` maps a nav href to how many things there need attention. */
export function AppSidebar({ badges = {} }: { badges?: Record<string, number> }) {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()
  const nav = useNav()
  const isActive = (href: string) =>
    href === "/settings" ? pathname === href : pathname === href || pathname.startsWith(href + "/")
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/lifepointe-mark.png" alt="" className="size-8 shrink-0" />
                <div className="grid text-left leading-tight">
                  <span className="font-display text-base font-bold">LifePointe</span>
                  <span className="text-xs text-muted-foreground">Church admin</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {nav.map((g) => (
          <SidebarGroup key={g.group}>
            <SidebarGroupLabel className="text-[11px] font-bold tracking-[0.06em] text-muted-foreground uppercase">{g.group}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.href)}
                      tooltip={badges[item.href] ? `${item.label} · ${badges[item.href]} waiting` : item.label}
                      className="relative font-semibold text-sidebar-foreground/85 transition-colors duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:font-bold data-[active=true]:text-sidebar-accent-foreground before:absolute before:top-1.5 before:bottom-1.5 before:left-0 before:w-[3px] before:origin-center before:scale-y-0 before:rounded-full before:bg-sidebar-primary before:transition-transform before:duration-300 data-[active=true]:before:scale-y-100 [&>svg]:transition-transform [&>svg]:duration-200 hover:[&>svg]:scale-110"
                    >
                      <Link href={item.href} onClick={() => setOpenMobile(false)}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                    {!!badges[item.href] && (
                      <SidebarMenuBadge className="rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground peer-hover/menu-button:text-primary-foreground peer-data-[active=true]/menu-button:text-primary-foreground" aria-label={`${badges[item.href]} waiting`}>
                        {badges[item.href] > 99 ? "99+" : badges[item.href]}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
