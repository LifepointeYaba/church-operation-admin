import { redirect } from "next/navigation"
import { homeFor, requireUser } from "@/lib/auth"

/** Send each user to the first page their role can open. */
export default async function Home() {
  const user = await requireUser()
  redirect(homeFor(user.role))
}
