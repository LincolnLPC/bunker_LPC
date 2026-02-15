const COOKIE_PREFIX = "v1:"

/**
 * Compute cookie value from gate password (Web Crypto, works in Node + Edge).
 * When password changes, this changes too — old cookies become invalid.
 */
export async function gateCookieValue(gatePassword: string): Promise<string> {
  const trimmed = gatePassword.trim()
  if (!trimmed) return ""
  const data = new TextEncoder().encode(trimmed)
  const hash = await crypto.subtle.digest("SHA-256", data)
  const hex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
  return COOKIE_PREFIX + hex
}

export async function isValidGateCookie(
  cookieValue: string | undefined,
  gatePassword: string
): Promise<boolean> {
  if (!cookieValue || !gatePassword?.trim()) return false
  const expected = await gateCookieValue(gatePassword)
  return cookieValue === expected
}
