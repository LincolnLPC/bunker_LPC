/**
 * Structured WebRTC logger - outputs JSON for parsing/analysis.
 * Logs can be read from console or collected for debugging.
 */

export type WebRTCLogLevel = "debug" | "info" | "warn" | "error"

export interface WebRTCLogEntry {
  ts: string
  level: WebRTCLogLevel
  ctx: string
  msg: string
  playerId?: string
  data?: Record<string, unknown>
  stack?: string
}

// In-memory buffer (last 500 entries) for debugging - can be read via getWebRTCLogs()
const LOG_BUFFER: WebRTCLogEntry[] = []
const MAX_BUFFER_SIZE = 500

function addToBuffer(entry: WebRTCLogEntry) {
  LOG_BUFFER.push(entry)
  if (LOG_BUFFER.length > MAX_BUFFER_SIZE) {
    LOG_BUFFER.shift()
  }
}

function formatEntry(entry: WebRTCLogEntry): string {
  return JSON.stringify(entry)
}

export function webRTCLog(
  level: WebRTCLogLevel,
  ctx: string,
  msg: string,
  data?: Record<string, unknown> & { playerId?: string }
) {
  const playerId = data?.playerId
  const { playerId: _p, ...restData } = data || {}
  const entry: WebRTCLogEntry = {
    ts: new Date().toISOString(),
    level,
    ctx,
    msg,
    ...(playerId && { playerId }),
    ...(Object.keys(restData || {}).length > 0 && { data: restData }),
  }
  addToBuffer(entry)
  const formatted = formatEntry(entry)

  switch (level) {
    case "debug":
      console.debug(`[WebRTC] ${formatted}`)
      break
    case "info":
      console.log(`[WebRTC] ${formatted}`)
      break
    case "warn":
      console.warn(`[WebRTC] ${formatted}`)
      break
    case "error":
      console.error(`[WebRTC] ${formatted}`)
      break
  }
}

export function webRTCLogError(
  ctx: string,
  msg: string,
  err: unknown,
  data?: Record<string, unknown> & { playerId?: string }
) {
  const errorName = err instanceof Error ? err.name : typeof err
  const errorMessage = err instanceof Error ? err.message : String(err)
  const stack = err instanceof Error ? err.stack : undefined
  const entry: WebRTCLogEntry = {
    ts: new Date().toISOString(),
    level: "error",
    ctx,
    msg,
    ...(data?.playerId && { playerId: data.playerId }),
    data: {
      ...data,
      errorName,
      errorMessage,
      ...(err instanceof DOMException && { errorCode: err.code }),
    },
    ...(stack && { stack: stack.split("\n").slice(0, 8).join("\n") }),
  }
  addToBuffer(entry)
  console.error(`[WebRTC] ${formatEntry(entry)}`)
}

/** Get recent logs for debugging (can be called from console: getWebRTCLogs()) */
export function getWebRTCLogs(): WebRTCLogEntry[] {
  return [...LOG_BUFFER]
}

/** Expose for console access */
if (typeof window !== "undefined") {
  (window as any).getWebRTCLogs = getWebRTCLogs
}
