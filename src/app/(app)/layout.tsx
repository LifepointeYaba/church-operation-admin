import { cookies } from "next/headers"
import { requireUser } from "@/lib/auth"
import { roleLabel } from "@/lib/permissions"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { TopBar } from "@/components/top-bar"
import { PermissionsProvider } from "@/components/permissions"
import { attentionCounts } from "@/lib/attention"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  const [cookieStore, badges] = await Promise.all([cookies(), attentionCounts()])
  const open = cookieStore.get("sidebar_state")?.value !== "false"
  return (
    <PermissionsProvider permissions={user.permissions}>
      <SidebarProvider defaultOpen={open}>
        <AppSidebar badges={badges} />
        <SidebarInset>
          <TopBar email={user.email} name={user.name} role={roleLabel(user.role)} themePref={user.themePref} />
          <div className="mx-auto w-full max-w-7xl flex-1 p-3 md:p-6">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </PermissionsProvider>
  )
}
