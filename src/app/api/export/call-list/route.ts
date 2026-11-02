import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { requireAdminApi } from "@/lib/auth"
import { audit } from "@/lib/audit"
import { toCsv } from "@/lib/csv-export"
import { memberStats, referenceService } from "@/lib/metrics"
import { CALL_LIST_LABELS, callLists, type CallListKey } from "@/lib/metrics/lists"
import { getSettings } from "@/lib/settings"
import { displayPhone } from "@/lib/phone"
import { formatDate, isoDate } from "@/lib/dates"

export async function GET(req: Request) {
  const admin = await requireAdminApi()
  if (admin instanceof Response) return admin
  const url = new URL(req.url)
  const key = url.searchParams.get("list") as CallListKey
  if (!(key in CALL_LIST_LABELS)) return Response.json({ error: "Unknown list" }, { status: 400 })
  const ref = await referenceService(url.searchParams.get("date"))
  if (!ref) return Response.json({ error: "No data" }, { status: 404 })
  const refIso = isoDate(ref.date)
  const people = callLists(await memberStats(refIso, {}), refIso, await getSettings())[key]
  const label = CALL_LIST_LABELS[key]
  const headers = ["Name", "Phone", "Status", "Team", "Person responsible", "Last attended"]
  const rows = people.map((m) => [`${m.firstName} ${m.lastName}`.trim(), displayPhone(m.phone), m.status, m.teams.join(", "), m.personResponsible ?? "", m.lastDate ? formatDate(m.lastDate, "long") : "Never"])
  await audit("export", "call_list", key, null, { date: refIso, count: rows.length, format: url.searchParams.get("format") ?? "csv" })
  const base = `${key}-${refIso}`
  if (url.searchParams.get("format") === "pdf") {
    const doc = new jsPDF({ orientation: "landscape" })
    doc.setFontSize(14)
    doc.text(`${label} — Sunday ${formatDate(refIso, "long")}`, 14, 16)
    doc.setFontSize(9)
    doc.text(`${rows.length} people · LifePointe · confidential`, 14, 22)
    autoTable(doc, { head: [headers], body: rows, startY: 27, styles: { fontSize: 9 }, headStyles: { fillColor: [42, 120, 214] } })
    return new Response(Buffer.from(doc.output("arraybuffer")), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${base}.pdf"` },
    })
  }
  return new Response(toCsv(headers, rows), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${base}.csv"` },
  })
}
