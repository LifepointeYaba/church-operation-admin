export type PhoneResult = {
  /** Display value as stored on the member (normalised when valid, raw otherwise). */
  phone: string | null
  /** +234 key used for matching; null when the number is missing or unusable. */
  phoneKey: string | null
  problem: "missing" | "short" | "invalid" | null
}

/** Normalise a Nigerian phone number to +234XXXXXXXXXX form. */
export function normalizePhone(raw: string | null | undefined): PhoneResult {
  const trimmed = (raw ?? "").trim()
  if (!trimmed) return { phone: null, phoneKey: null, problem: "missing" }
  let digits = trimmed.replace(/\D/g, "")
  if (digits.startsWith("234") && digits.length === 13) digits = "0" + digits.slice(3)
  if (digits.length === 11 && digits.startsWith("0")) {
    const key = "+234" + digits.slice(1)
    return { phone: key, phoneKey: key, problem: null }
  }
  if (digits.length === 10 && /^[789]/.test(digits)) {
    const key = "+234" + digits
    return { phone: key, phoneKey: key, problem: null }
  }
  return { phone: trimmed, phoneKey: null, problem: digits.length < 10 ? "short" : "invalid" }
}

/** Format a stored +234 number for local display: +2347051184614 → 0705 118 4614 */
export function displayPhone(phone: string | null | undefined): string {
  if (!phone) return ""
  if (/^\+234\d{10}$/.test(phone)) {
    const local = "0" + phone.slice(4)
    return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`
  }
  return phone
}
