/**
 * WebRTC Signaling через Supabase Realtime
 * Оптимизировано: retry, порядок событий, буферизация
 */

import { createClient } from "@/lib/supabase/client"
import type { RealtimeChannel } from "@supabase/supabase-js"

export interface WebRTCSignal {
  type: "offer" | "answer" | "ice-candidate"
  from: string
  to: string
  data: RTCSessionDescriptionInit | RTCIceCandidateInit | null
  roomId: string
}

const CONNECT_RETRY_DELAYS = [1000, 2000, 4000]
const SEND_RETRY_ATTEMPTS = 3
const SEND_RETRY_DELAY = 300
const SUBSCRIBE_TIMEOUT_MS = 15000
const SIGNAL_BUFFER_WINDOW_MS = 6000 // Буфер сигналов после подключения (чтобы не потерять offer при обновлении страницы)

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export class WebRTCSignaling {
  private channel: RealtimeChannel | null = null
  private supabase = createClient()
  private roomId: string
  private currentPlayerId: string
  private onSignalCallback: ((signal: WebRTCSignal) => void) | null = null
  private connectPromise: Promise<RealtimeChannel> | null = null
  private isConnecting = false
  private signalBuffer: WebRTCSignal[] = []
  private bufferFlushScheduled = false
  private connectedAt = 0

  constructor(roomId: string, currentPlayerId: string) {
    this.roomId = roomId
    this.currentPlayerId = currentPlayerId
  }

  async connect(onSignal: (signal: WebRTCSignal) => void): Promise<RealtimeChannel> {
    if (!this.roomId || !this.currentPlayerId) {
      throw new Error(`Cannot connect: missing roomId or playerId`)
    }

    if (this.isConnecting && this.connectPromise) {
      return this.connectPromise
    }

    if (this.channel?.state === "joined") {
      return this.channel
    }

    this.onSignalCallback = onSignal
    this.isConnecting = true
    this.connectPromise = this._doConnectWithRetry()
      .then((ch) => {
        this.isConnecting = false
        this.connectPromise = null
        return ch
      })
      .catch((err) => {
        this.isConnecting = false
        this.connectPromise = null
        throw err
      })

    return this.connectPromise
  }

  private async _doConnectWithRetry(): Promise<RealtimeChannel> {
    let lastError: Error | null = null
    for (let attempt = 0; attempt <= CONNECT_RETRY_DELAYS.length; attempt++) {
      try {
        const ch = await this._doConnect()
        if (ch) return ch
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        console.warn(`[Signaling] Connect attempt ${attempt + 1} failed:`, lastError.message)
        if (attempt < CONNECT_RETRY_DELAYS.length) {
          await delay(CONNECT_RETRY_DELAYS[attempt])
        }
      }
    }
    throw lastError ?? new Error("Signaling connect failed")
  }

  private async _doConnect(): Promise<RealtimeChannel> {
    if (this.channel?.state === "closed" || this.channel?.state === "channels_closed") {
      try {
        await this.channel.unsubscribe()
      } catch {
        /* ignore */
      }
      this.channel = null
    }

    if (!this.channel) {
      this.channel = this.supabase.channel(`webrtc:${this.roomId}`, {
        config: { broadcast: { self: false } },
      })

      this.channel.on("broadcast", { event: "webrtc-signal" }, ({ payload }) => {
        const signal = payload as WebRTCSignal
        if (signal.to !== this.currentPlayerId || signal.from === this.currentPlayerId) return

        const inBufferWindow = Date.now() - this.connectedAt < SIGNAL_BUFFER_WINDOW_MS
        if (inBufferWindow) {
          this.signalBuffer.push(signal)
          this._scheduleBufferFlush()
        } else {
          this._deliverSignal(signal)
        }
      })
    }

    if (this.channel.state === "joined") {
      this.connectedAt = Date.now()
      return this.channel
    }

    await new Promise<void>((resolve, reject) => {
      let resolved = false
      const timeout = setTimeout(() => {
        if (resolved) return
        resolved = true
        reject(new Error("Signaling channel subscribe timeout"))
      }, SUBSCRIBE_TIMEOUT_MS)

      this.channel!.subscribe((status) => {
        if (resolved) return
        if (status === "SUBSCRIBED") {
          resolved = true
          clearTimeout(timeout)
          this.connectedAt = Date.now()
          resolve()
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          resolved = true
          clearTimeout(timeout)
          reject(new Error(`Signaling subscribe failed: ${status}`))
        }
      })
    })

    return this.channel!
  }

  private _scheduleBufferFlush() {
    if (this.bufferFlushScheduled) return
    this.bufferFlushScheduled = true
    setTimeout(() => this._flushBuffer(), 100)
  }

  private _flushBuffer() {
    this.bufferFlushScheduled = false
    if (this.signalBuffer.length === 0) return

    const signals = this.signalBuffer.splice(0)
    const byPeer = new Map<string, WebRTCSignal[]>()
    for (const s of signals) {
      const key = s.from
      if (!byPeer.has(key)) byPeer.set(key, [])
      byPeer.get(key)!.push(s)
    }

    for (const [, peerSignals] of byPeer) {
      const ordered = this._orderSignals(peerSignals)
      for (const s of ordered) {
        this._deliverSignal(s)
      }
    }
  }

  private _orderSignals(signals: WebRTCSignal[]): WebRTCSignal[] {
    const offer = signals.find((s) => s.type === "offer")
    const answer = signals.find((s) => s.type === "answer")
    const ice = signals.filter((s) => s.type === "ice-candidate")
    const result: WebRTCSignal[] = []
    if (offer) result.push(offer)
    if (answer) result.push(answer)
    result.push(...ice)
    return result
  }

  private _deliverSignal(signal: WebRTCSignal) {
    if (this.onSignalCallback) {
      try {
        this.onSignalCallback(signal)
      } catch (err) {
        console.error("[Signaling] Error in signal callback:", err)
      }
    }
  }

  async sendSignal(signal: Omit<WebRTCSignal, "roomId" | "from">) {
    if (!this.channel || this.channel.state !== "joined") {
      throw new Error("Channel not connected. Call connect() first.")
    }

    const fullSignal: WebRTCSignal = {
      ...signal,
      from: this.currentPlayerId,
      roomId: this.roomId,
    }

    let lastError: Error | null = null
    for (let attempt = 0; attempt < SEND_RETRY_ATTEMPTS; attempt++) {
      try {
        await this.channel.send({
          type: "broadcast",
          event: "webrtc-signal",
          payload: fullSignal,
        })
        return
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        if (attempt < SEND_RETRY_ATTEMPTS - 1) {
          await delay(SEND_RETRY_DELAY)
        }
      }
    }
    throw lastError ?? new Error("Failed to send signal")
  }

  async sendOffer(to: string, offer: RTCSessionDescriptionInit) {
    await this.sendSignal({ type: "offer", to, data: offer })
  }

  async sendAnswer(to: string, answer: RTCSessionDescriptionInit) {
    await this.sendSignal({ type: "answer", to, data: answer })
  }

  async sendIceCandidate(to: string, candidate: RTCIceCandidateInit) {
    await this.sendSignal({ type: "ice-candidate", to, data: candidate })
  }

  async disconnect() {
    this.isConnecting = false
    this.connectPromise = null
    this.signalBuffer = []
    this.bufferFlushScheduled = false
    this.onSignalCallback = null

    if (this.channel) {
      try {
        if (this.channel.state !== "closed" && this.channel.state !== "channels_closed") {
          await this.channel.unsubscribe()
        }
      } catch {
        /* ignore */
      }
      this.channel = null
    }
  }

  get connected(): boolean {
    return this.channel?.state === "joined"
  }
}
