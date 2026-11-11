import { redirect } from "next/navigation"
import { requireUser } from "@/lib/auth"
import { AuthHeading } from "../heading"
import { SetPasswordForm } from "./form"

export const metadata = { title: "Choose your password" }

export default async function ChangePasswordPage() {
  const user = await requireUser({ allowPasswordChange: true })
  if (!user.mustChangePassword) redirect("/")
  return (
    <>
      <AuthHeading title={`Welcome${user.name ? `, ${user.name.split(" ")[0]}` : ""}`} description={user.email} />
      <SetPasswordForm email={user.email} />
    </>
  )
}
