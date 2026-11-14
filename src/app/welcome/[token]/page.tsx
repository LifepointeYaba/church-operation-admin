import type { Metadata } from "next"
import { prisma } from "@/lib/db"
import { linkWindow } from "@/lib/first-timers"
import { formatDate, isoDate } from "@/lib/dates"
import { WelcomeForm } from "./welcome-form"

export const metadata: Metadata = { title: "Welcome Home · LifePointe" }
export const dynamic = "force-dynamic"

export default async function WelcomePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const link = await prisma.firstTimerLink.findUnique({ where: { token }, select: { serviceDate: true, active: true } })
  const window = link ? linkWindow(link.serviceDate) : null
  const message = !link
    ? "This link isn’t valid. Please scan the QR code shared in church today."
    : !link.active || (window && !window.open && window.reason === "closed")
      ? "This welcome form has closed. Speak to anyone at the welcome desk and we’ll get you connected."
      : window && !window.open
        ? `This form opens the day before Sunday ${formatDate(isoDate(link.serviceDate), "long")}.`
        : null
  return (
    <main className="min-h-svh bg-gradient-to-b from-orange-50 via-background to-background px-4 py-8 dark:from-orange-950/20">
      <div className="mx-auto w-full max-w-lg">
        {message
          ? (
            <div className="space-y-4 pt-16 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/lifepointe-mark.png" alt="LifePointe" className="mx-auto size-16" />
              <p className="text-lg">{message}</p>
            </div>
          )
          : <WelcomeForm token={token} sunday={formatDate(isoDate(link!.serviceDate), "long")} />}
      </div>
    </main>
  )
}
