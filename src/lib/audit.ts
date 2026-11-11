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

export type Actor = { id: string; email: string | null }

/** The signed-in user making this request, or null (cron jobs, scripts, signed-out requests). */
async function sessionActor(): Promise<Actor | null> {
  try {
    const { auth } = await import("./auth")
    const session = await auth()
    const id = session?.user?.id
    return id ? { id, email: session.user?.email ?? null } : null
  } catch {
    return null
  }
}

const json = (v: unknown) => (v === undefined ? undefined : (JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue))

/**
 * Record something that happened. The actor defaults to the signed-in user;
 * pass `actor` explicitly where there is no session yet (sign-in) or `null` for "nobody".
 */
export async function audit(
  action: string,
  entity: string,
  entityId?: string | number | null,
  before?: unknown,
  after?: unknown,
  ip?: string | null,
  actor?: Actor | null,
) {
  const who = actor === undefined ? await sessionActor() : actor
  await prisma.auditLog.create({
    data: {
      action,
      entity,
      entityId: entityId == null ? null : String(entityId),
      before: json(before),
      after: json(after),
      ip: ip === undefined ? await clientIp() : ip,
      actorId: who?.id ?? null,
      actorEmail: who?.email ?? null,
    },
  })
}
