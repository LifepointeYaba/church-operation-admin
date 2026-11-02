import { requireAdminApi } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { audit } from "@/lib/audit"

/** Download the original uploaded file (proxied so the link only works when signed in). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi()
  if (admin instanceof Response) return admin
  const up = await prisma.upload.findUnique({ where: { id: Number((await params).id) } })
  if (!up?.blobUrl) return Response.json({ error: "Original file not stored" }, { status: 404 })
  const file = await fetch(up.blobUrl)
  await audit("download", "upload", up.id)
  return new Response(file.body, {
    headers: {
      "Content-Type": file.headers.get("content-type") ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${up.fileName.replace(/"/g, "")}"`,
    },
  })
}
