import NextAuth from "next-auth"
import { NextResponse } from "next/server"
import { authConfig } from "@/lib/auth.config"

const { auth } = NextAuth(authConfig)

// /welcome is the public first-timer form (shared by link / QR code).
const PUBLIC = ["/login", "/reset-password", "/api/auth", "/welcome"]

export default auth((req) => {
  const { pathname } = req.nextUrl
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) return NextResponse.next()
  if (pathname.startsWith("/api/cron")) return NextResponse.next() // protected by CRON_SECRET
  if (!req.auth) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const url = new URL("/login", req.url)
    if (pathname !== "/") url.searchParams.set("next", pathname)
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico|jpg)$).*)"],
}
