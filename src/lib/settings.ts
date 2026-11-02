import { prisma } from "./db"

export const DEFAULT_STATUSES = [
  "First Timer",
  "Second Timer",
  "Regular, not done membership class",
  "Member",
  "Worker",
  "Member from other expressions",
  "Not Active",
]

export type AppSettings = {
  atRiskWeeks: number
  inactiveWeeks: number
  minVisitsForRisk: number
  workerMissWeeks: number
  statuses: string[]
}

export const DEFAULT_SETTINGS: AppSettings = {
  atRiskWeeks: 4,
  inactiveWeeks: 8,
  minVisitsForRisk: 3,
  workerMissWeeks: 2,
  statuses: DEFAULT_STATUSES,
}

export async function getSettings(): Promise<AppSettings> {
  const rows = await prisma.setting.findMany()
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  return { ...DEFAULT_SETTINGS, ...map } as AppSettings
}

export async function saveSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
  await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } })
}
