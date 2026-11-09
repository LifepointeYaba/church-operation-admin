import { cookies } from "next/headers"
import { requireAdmin } from "@/lib/auth"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { TopBar } from "@/components/top-bar"
import { attentionCounts } from "@/lib/attention"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin()
  const [cookieStore, badges] = await Promise.all([cookies(), attentionCounts()])
  const open = cookieStore.get("sidebar_state")?.value !== "false"
  return (
    <SidebarProvider defaultOpen={open}>
      <AppSidebar badges={badges} />
      <SidebarInset>
        <TopBar email={admin.email} themePref={admin.themePref} />
        <div className="mx-auto w-full max-w-7xl flex-1 p-3 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
