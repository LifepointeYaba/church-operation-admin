/** Password rules shared by server and client (no native modules here). */
export const MIN_PASSWORD_LENGTH = 10

export function passwordProblem(pw: string): string | null {
  if (pw.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
  return null
}

/** How long a generated (temporary) password can be used to sign in. */
export const TEMP_PASSWORD_MINUTES = 20
