const ONLINE_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutes

export function isUserOnline(lastSeenAt: string | null | undefined, showOnlineStatus = true): boolean {
  if (!showOnlineStatus || !lastSeenAt) return false
  const seen = new Date(lastSeenAt).getTime()
  return Date.now() - seen < ONLINE_THRESHOLD_MS
}

export { ONLINE_THRESHOLD_MS }
