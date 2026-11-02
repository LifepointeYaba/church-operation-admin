import { hash, verify } from "@node-rs/argon2"

export const MIN_PASSWORD_LENGTH = 10

export function passwordProblem(pw: string): string | null {
  if (pw.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
  return null
}

export const hashPassword = (pw: string) => hash(pw, { memoryCost: 19456, timeCost: 2, parallelism: 1 })
export const verifyPassword = (hashed: string, pw: string) => verify(hashed, pw).catch(() => false)
