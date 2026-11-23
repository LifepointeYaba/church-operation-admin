import Link from "next/link"
import { headers } from "next/headers"
import QRCode from "qrcode"
import { requirePermission } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { linkWindow, upcomingSunday } from "@/lib/first-timers"
import { formatDate, fromIso, isSunday, isoDate } from "@/lib/dates"
import { displayPhone } from "@/lib/phone"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { EmptyState, PageHeader } from "@/components/common"
import { NavLink } from "@/components/navigation"
import { cn } from "@/lib/utils"
import { CopyLinkButton, DeleteLinkButton, DeleteRegistrationButton, DownloadQrButton, GenerateLinkForm, LinkActiveToggle } from "./first-timers-client"

export const metadata = { title: "First timer link" }

async function baseUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "")
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")
  return `${proto}://${host}`
}

export default async function FirstTimersPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  await requirePermission("attendance.mark")
  const sp = await searchParams
  const picked = sp.date ? fromIso(sp.date) : null
  const date = picked && isSunday(picked) ? isoDate(picked) : upcomingSunday()

  const [link, recent] = await Promise.all([
    prisma.firstTimerLink.findUnique({
      where: { serviceDate: new Date(`${date}T00:00:00.000Z`) },
      include: {
        responses: {
          orderBy: { createdAt: "desc" },
          include: { member: { select: { id: true, status: true } } },
        },
      },
    }),
    prisma.firstTimerLink.findMany({ orderBy: { serviceDate: "desc" }, take: 12, include: { _count: { select: { responses: true } } } }),
  ])

  const url = link ? `${await baseUrl()}/welcome/${link.token}` : null
  const [qrPng, qrSvg] = url
    ? await Promise.all([
      QRCode.toDataURL(url, { width: 1024, margin: 2, errorCorrectionLevel: "M", color: { dark: "#1c1917", light: "#ffffff" } }),
      QRCode.toString(url, { type: "svg", margin: 2, errorCorrectionLevel: "M", color: { dark: "#1c1917", light: "#ffffff" } }),
    ])
    : [null, null]
  const window = link ? linkWindow(link.serviceDate) : null
  const localOnly = url ? /\/\/(localhost|127\.0\.0\.1)/.test(url) : false

  return (
    <div className="stagger space-y-4">
      <PageHeader
        title="First timer link"
        description="Generate the welcome form for a Sunday. Share the link or print the QR code — everyone who fills it is saved as a First Timer and marked present."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sunday {formatDate(date, "long")}</CardTitle>
          <CardDescription>The form opens the day before the Sunday and closes at the end of that Sunday.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <GenerateLinkForm date={date} hasLink={!!link} />
          {link && url && qrPng && (
            <div className="grid gap-5 md:grid-cols-[220px_1fr]">
              <div className="mx-auto w-full max-w-[240px] rounded-xl border bg-white p-3 md:max-w-none">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrPng} alt={`QR code for the first timer form, Sunday ${formatDate(date, "long")}`} className="w-full" />
              </div>
              <div className="min-w-0 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  {!link.active
                    ? <Badge variant="destructive">Closed</Badge>
                    : window?.open
                      ? <Badge className="bg-emerald-600 text-white">Open</Badge>
                      : <Badge variant="outline">{window?.reason === "closed" ? "Window ended" : "Opens the day before"}</Badge>}
                  <span className="text-sm text-muted-foreground">{link.responses.length} registered</span>
                </div>
                <div className="flex min-w-0 items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
                  <code className="min-w-0 flex-1 truncate text-xs sm:text-sm">{url}</code>
                  <div className="shrink-0"><CopyLinkButton url={url} /></div>
                </div>
                {/* Phones: a tidy 2-column grid of full-width buttons; wider screens: one wrapping row. */}
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap [&>*]:w-full sm:[&>*]:w-auto">
                  <DownloadQrButton href={qrPng} fileName={`first-timer-qr-${date}.png`} label="QR (PNG)" />
                  <DownloadQrButton href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg!)}`} fileName={`first-timer-qr-${date}.svg`} label="SVG (print)" variant="outline" />
                  <LinkActiveToggle id={link.id} active={link.active} />
                  <DeleteLinkButton id={link.id} label={`Sunday ${formatDate(date, "long")}`} registrations={link.responses.length} />
                </div>
                {localOnly && (
                  <Alert>
                    <AlertDescription>
                      This link points to <strong>localhost</strong>, so phones can’t open it. Open this page on the live site, or set <code>APP_URL</code> to the public address, before printing the QR code.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {link && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Registered on this link ({link.responses.length})</CardTitle>
            <CardDescription>Already marked present for {formatDate(date, "long")}. When the attendance file for this Sunday is uploaded, these people are matched and skipped; first timers who aren’t here go to review.</CardDescription>
          </CardHeader>
          <CardContent>
            {link.responses.length === 0 ? <EmptyState title="No one has registered yet" /> : (<>
              <ul className="divide-y rounded-md border sm:hidden">
                {link.responses.map((r) => (
                  <li key={r.id} className="flex gap-2 p-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-baseline justify-between gap-2">
                        {r.member
                          ? <Link href={`/members/${r.member.id}`} className="truncate font-medium hover:underline">{r.fullName}</Link>
                          : <span className="truncate font-medium">{r.fullName}</span>}
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {r.createdAt.toLocaleTimeString("en-GB", { timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-sm">
                        <a href={`tel:${r.phone}`} className="tabular-nums hover:underline">{displayPhone(r.phone)}</a>
                        {!r.onWhatsapp && <span className="text-muted-foreground"> · Not on WhatsApp</span>}
                        {r.matchedExisting && <span className="text-muted-foreground"> · already registered</span>}
                      </p>
                      {[...r.interests, ...r.growth].length > 0 && (
                        <p className="text-xs text-muted-foreground">{[...r.interests, ...r.growth].join(", ")}</p>
                      )}
                      {r.prayerRequest && <p className="line-clamp-3 text-xs italic text-muted-foreground">“{r.prayerRequest}”</p>}
                    </div>
                    <div className="shrink-0"><DeleteRegistrationButton id={r.id} name={r.fullName} /></div>
                  </li>
                ))}
              </ul>
              <div className="hidden max-h-[560px] overflow-auto rounded-md border sm:block">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-muted">
                    <tr className="text-left">
                      <th className="px-3 py-2 font-medium">Name</th>
                      <th className="px-3 py-2 font-medium">Phone</th>
                      <th className="hidden px-3 py-2 font-medium md:table-cell">Interested in</th>
                      <th className="hidden px-3 py-2 font-medium lg:table-cell">Prayer request</th>
                      <th className="px-3 py-2 font-medium">Time</th>
                      <th className="w-10 px-1 py-2"><span className="sr-only">Delete</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {link.responses.map((r) => (
                      <tr key={r.id} className="border-t align-top">
                        <td className="px-3 py-2">
                          {r.member ? <Link href={`/members/${r.member.id}`} className="font-medium hover:underline">{r.fullName}</Link> : r.fullName}
                          {r.matchedExisting && <span className="ml-1.5 text-xs text-muted-foreground">(already registered)</span>}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {displayPhone(r.phone)}
                          {!r.onWhatsapp && <span className="block text-xs text-muted-foreground">Not on WhatsApp</span>}
                        </td>
                        <td className="hidden px-3 py-2 text-muted-foreground md:table-cell">{[...r.interests, ...r.growth].join(", ") || "—"}</td>
                        <td className="hidden max-w-xs px-3 py-2 text-muted-foreground lg:table-cell">{r.prayerRequest ?? "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                          {r.createdAt.toLocaleTimeString("en-GB", { timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-1 py-1 text-right"><DeleteRegistrationButton id={r.id} name={r.fullName} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>)}
          </CardContent>
        </Card>
      )}

      {recent.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Recent links</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {recent.map((l) => {
                const d = isoDate(l.serviceDate)
                return (
                  <li key={l.id} className="flex items-center gap-1">
                    <NavLink href={`?date=${d}`} className={cn("flex min-w-0 flex-1 flex-col py-2 hover:underline sm:flex-row sm:items-center sm:justify-between sm:gap-3", d === date && "font-semibold")}>
                      <span>Sunday {formatDate(d, "long")}</span>
                      <span className="text-muted-foreground">{l._count.responses} registered{!l.active && " · closed"}</span>
                    </NavLink>
                    <DeleteLinkButton id={l.id} label={`Sunday ${formatDate(d, "long")}`} registrations={l._count.responses} size="icon" />
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
