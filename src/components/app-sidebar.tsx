"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3, CalendarCheck, ClipboardList, FileClock, LayoutDashboard, PhoneCall, Settings, Upload, Users,
} from "lucide-react"
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu,
  SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarRail, useSidebar,
} from "@/components/ui/sidebar"

export const NAV = [
  { group: "Overview", items: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/trends", label: "Trends", icon: BarChart3 },
  ] },
  { group: "Sunday", items: [
    { href: "/attendance", label: "Mark attendance", icon: CalendarCheck },
    { href: "/headcount", label: "Weekly headcount", icon: ClipboardList },
    { href: "/call-lists", label: "Call lists", icon: PhoneCall },
  ] },
  { group: "Records", items: [
    { href: "/members", label: "Members", icon: Users },
    { href: "/uploads", label: "Uploads & import", icon: Upload },
  ] },
  { group: "Admin", items: [
    { href: "/settings", label: "Settings", icon: Settings },
    { href: "/settings/audit", label: "Audit log", icon: FileClock },
  ] },
]

/** `badges` maps a nav href to how many things there need attention. */
export function AppSidebar({ badges = {} }: { badges?: Record<string, number> }) {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()
  const isActive = (href: string) =>
    href === "/settings" ? pathname === href : pathname === href || pathname.startsWith(href + "/")
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
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
        {NAV.map((g) => (
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
