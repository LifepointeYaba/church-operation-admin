import { randomInt } from "crypto"
import { hash, verify } from "@node-rs/argon2"

export { MIN_PASSWORD_LENGTH, passwordProblem, TEMP_PASSWORD_MINUTES } from "./password-rules"

export const hashPassword = (pw: string) => hash(pw, { memoryCost: 19456, timeCost: 2, parallelism: 1 })
export const verifyPassword = (hashed: string, pw: string) => verify(hashed, pw).catch(() => false)

// No 0/O, 1/l/I: easy to read out or copy by hand.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"

/** A random one-time password like `Kf7q-Xm2B-pR9w` (~71 bits). */
export function generateTempPassword(): string {
  const group = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("")
  return [group(), group(), group()].join("-")
}
