/**
 * Structured logging for camera/microphone flow.
 * All lines start with [MEDIA] and contain a JSON object so logs can be parsed.
 * Keys: t (ISO timestamp), event (short name), then event-specific fields.
 */

const PREFIX = "[MEDIA]"

function payload(obj: Record<string, unknown>): string {
  try {
    return JSON.stringify({ t: new Date().toISOString(), ...obj })
  } catch {
    return JSON.stringify({ t: new Date().toISOString(), event: "log_serialize_error" })
  }
}

function out(level: "log" | "warn" | "error", obj: Record<string, unknown>) {
  const line = `${PREFIX} ${payload(obj)}`
  if (level === "error") console.error(line)
  else if (level === "warn") console.warn(line)
  else console.log(line)
}

export const mediaLog = {
  /** initializeMedia started (game page or manual) */
  initStart: (p: { video: boolean; audio: boolean; vdoNinjaUrl: string | null; roomId?: string; playerId?: string }) =>
    out("log", { event: "init_start", ...p }),

  /** Skipping getUserMedia (e.g. VDO.ninja) */
  skip: (p: { reason: string; video: boolean; audio: boolean }) =>
    out("log", { event: "skip", ...p }),

  /** Browser lacks getUserMedia */
  noGetUserMedia: () =>
    out("warn", { event: "no_get_user_media" }),

  /** About to call getUserMedia */
  getUserMediaCall: (p: { video: boolean; audio: boolean; withDeviceId: boolean; useMinimal?: boolean; timeoutMs?: number }) =>
    out("log", { event: "get_user_media_call", ...p }),

  /** getUserMedia succeeded */
  getUserMediaOk: (p: { streamId: string; videoTracks: number; audioTracks: number; attempt: "first" | "retry"; videoLabels?: string[]; audioLabels?: string[] }) =>
    out("log", { event: "get_user_media_ok", ...p }),

  /** getUserMedia failed (before retry) */
  getUserMediaFail: (p: { name: string; message: string; isRetryable: boolean; willRetry: boolean }) =>
    out("warn", { event: "get_user_media_fail", ...p }),

  /** enumerateDevices called (e.g. for retry or profile page) */
  enumerateDevices: (p: { videoCount: number; audioCount: number; cameraIds?: string[]; microphoneIds?: string[] }) =>
    out("log", { event: "enumerate_devices", ...p }),

  /** Stream tracks state after success */
  streamTracks: (p: { streamId: string; video: Array<{ id: string; label: string; enabled: boolean; readyState: string }>; audio: Array<{ id: string; label: string; enabled: boolean; readyState: string }> }) =>
    out("log", { event: "stream_tracks", ...p }),

  /** Track ended (device disconnected) */
  trackEnded: (p: { kind: string; label: string }) =>
    out("warn", { event: "track_ended", ...p }),

  /** Track error */
  trackError: (p: { kind: string; label: string; error?: string }) =>
    out("error", { event: "track_error", ...p }),

  /** Media init error. Uses warn for recoverable (deviceInUse/permissionDenied/timeout) so dev overlay doesn't show. */
  initError: (p: { name: string; message: string; code?: number; permissionDenied?: boolean; deviceInUse?: boolean; timeout?: boolean }) =>
    out(p.permissionDenied || p.deviceInUse || p.timeout ? "warn" : "error", { event: "init_error", ...p }),

  /** Game page: conditions for auto-request */
  autoRequestCheck: (p: { willRequest: boolean; reasons?: string[]; loading?: boolean; settingsLoaded?: boolean; hasRoomId?: boolean; hasPlayerId?: boolean; notInitialized?: boolean; requestInProgress?: boolean; autoCamera?: boolean; autoMic?: boolean }) =>
    out("log", { event: "auto_request_check", ...p }),

  /** Game page: media initialized (success or skipped) */
  autoRequestDone: (p: { success: boolean; streamId?: string; videoTracks?: number; audioTracks?: number; reason?: string }) =>
    out("log", { event: "auto_request_done", ...p }),

  /** Profile: devices loaded for selector */
  profileDevices: (p: { cameras: number; microphones: number; cameraLabels?: string[]; microphoneLabels?: string[] }) =>
    out("log", { event: "profile_devices", ...p }),

  /** Media settings loaded from backend */
  settingsLoaded: (p: { autoCamera: boolean; autoMic: boolean; defaultCameraOn: boolean; defaultMicOn: boolean; hasVdoNinja: boolean; cameraDeviceId: string | null; microphoneDeviceId: string | null }) =>
    out("log", { event: "settings_loaded", ...p }),

  /** PlayerCard: source of video (local stream vs VDO.ninja iframe) */
  playerCardSource: (p: { playerId: string; isCurrentPlayer: boolean; useVdoNinja: boolean; hasStream: boolean; streamId?: string }) =>
    out("log", { event: "player_card_source", ...p }),
}
