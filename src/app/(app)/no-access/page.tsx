import Link from "next/link"
import { ShieldOff } from "lucide-react"
import { homeFor, requireUser } from "@/lib/auth"
import { PERMISSIONS, roleLabel, type Permission } from "@/lib/permissions"
import { Button } from "@/components/ui/button"

export const metadata = { title: "No access" }

export default async function NoAccessPage({ searchParams }: { searchParams: Promise<{ need?: string }> }) {
  const user = await requireUser()
  const { need } = await searchParams
  const what = need && need in PERMISSIONS ? PERMISSIONS[need as Permission].toLowerCase() : null
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <ShieldOff className="size-10 text-muted-foreground" />
      <h2 className="text-xl font-semibold">You don’t have access to this page</h2>
      <p className="text-sm text-muted-foreground">
        Your role is <span className="font-medium text-foreground">{roleLabel(user.role)}</span>
        {what ? <>, which can’t {what}.</> : "."} Ask an admin if you need it.
      </p>
      <Button asChild><Link href={homeFor(user.role)}>Go to my home page</Link></Button>
    </div>
  )
}
