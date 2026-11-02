import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { LoginForm } from "./login-form"

export const metadata = { title: "Sign in" }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const session = await auth()
  if (session?.user) redirect("/dashboard")
  const { next } = await searchParams
  return <LoginForm next={next} />
}
