import { headers } from "next/headers"
import type { Prisma } from "@prisma/client"
import { prisma } from "./db"

export async function clientIp(): Promise<string | null> {
  try {
    const h = await headers()
    return h.get("x-forwarded-for")?.split(",")[0].trim() ?? h.get("x-real-ip") ?? null
  } catch {
    return null
  }
}

const json = (v: unknown) => (v === undefined ? undefined : (JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue))

export async function audit(
  action: string,
  entity: string,
  entityId?: string | number | null,
  before?: unknown,
  after?: unknown,
  ip?: string | null,
) {
  await prisma.auditLog.create({
    data: {
      action,
      entity,
      entityId: entityId == null ? null : String(entityId),
      before: json(before),
      after: json(after),
      ip: ip === undefined ? await clientIp() : ip,
    },
  })
}
