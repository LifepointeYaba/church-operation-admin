import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { AuthHeading } from "../heading"
import { LoginForm } from "./login-form"

export const metadata = { title: "Sign in" }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const session = await auth()
  if (session?.user) redirect("/")
  const { next } = await searchParams
  return (
    <>
      <AuthHeading title="Welcome back" description="Sign in with the account your admin set up for you." />
      <LoginForm next={next} />
    </>
  )
}
