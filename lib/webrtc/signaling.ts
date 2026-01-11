/**
 * WebRTC Signaling через Supabase Realtime
 * Обрабатывает обмен SDP offers/answers и ICE кандидатами
 */

import { createClient } from "@/lib/supabase/client"
import type { RealtimeChannel } from "@supabase/supabase-js"

export interface WebRTCSignal {
  type: "offer" | "answer" | "ice-candidate"
  from: string // playerId отправителя
  to: string // playerId получателя
  data: RTCSessionDescriptionInit | RTCIceCandidateInit | null
  roomId: string
}

export class WebRTCSignaling {
  private channel: RealtimeChannel | null = null
  private supabase = createClient()
  private roomId: string
  private currentPlayerId: string
  private onSignalCallback: ((signal: WebRTCSignal) => void) | null = null

  constructor(roomId: string, currentPlayerId: string) {
    this.roomId = roomId
    this.currentPlayerId = currentPlayerId
  }

  /**
   * Подключиться к каналу сигналинга
   */
  async connect(onSignal: (signal: WebRTCSignal) => void) {
    // Сохранить колбэк для обработки сигналов
    this.onSignalCallback = onSignal

    // Если канал уже подключен, просто вернуть его
    if (this.channel) {
      // Проверить статус подключения канала
      const state = this.channel.state
      if (state === "joined" || state === "joining") {
        return this.channel
      }
      // Если канал закрыт или в неправильном состоянии, создать новый
      if (state === "closed" || state === "channels_closed" || state === "CHANNEL_ERROR") {
        console.debug(`[Signaling] Channel is ${state}, creating new channel`)
        this.channel = null
      }
    }

    // Создать новый канал, если его нет
    if (!this.channel) {
      this.channel = this.supabase.channel(`webrtc:${this.roomId}`, {
        config: {
          broadcast: { self: false },
        },
      })

      // Слушаем сигналы WebRTC
      this.channel.on("broadcast", { event: "webrtc-signal" }, ({ payload }) => {
        const signal = payload as WebRTCSignal
        console.log(`[Signaling] Received signal: ${signal.type} from ${signal.from} to ${signal.to} (current: ${this.currentPlayerId})`)
        // Принимаем сигналы только если они предназначены нам или от нас
        if (signal.to === this.currentPlayerId && signal.from !== this.currentPlayerId) {
          console.log(`[Signaling] Processing signal: ${signal.type} from ${signal.from}`, {
            hasCallback: !!this.onSignalCallback,
            signalData: signal.data ? (signal.type === "ice-candidate" ? "ICE candidate" : "SDP") : "null"
          })
          if (this.onSignalCallback) {
            this.onSignalCallback(signal)
          } else {
            console.warn(`[Signaling] No callback registered for signal from ${signal.from}`)
          }
        } else {
          console.debug(`[Signaling] Ignoring signal: not for us (to: ${signal.to}, current: ${this.currentPlayerId})`)
        }
      })
    }

    // Проверить, подписан ли канал уже
    const currentState = this.channel.state
    if (currentState === "joined") {
      console.debug("[Signaling] Channel already subscribed")
      return this.channel
    }
    
    // Если канал в процессе подключения, подождать
    if (currentState === "joining") {
      console.debug("[Signaling] Channel is joining, waiting...")
      // Подождать немного и проверить снова
      await new Promise((resolve) => setTimeout(resolve, 200))
      if (this.channel && this.channel.state === "joined") {
        return this.channel
      }
      // Если все еще не подключен, продолжить процесс подписки
    }

    // Если канал в процессе закрытия, подождать немного и создать новый
    if (currentState === "closed" || currentState === "channels_closed") {
      console.debug(`[Signaling] Channel is ${currentState}, waiting before reconnect`)
      await new Promise((resolve) => setTimeout(resolve, 100))
      this.channel = null
      return this.connect(onSignal) // Рекурсивно переподключиться
    }

    // Подписаться на канал и дождаться подключения
    const subscribePromise = new Promise<void>((resolve, reject) => {
      let timeout: NodeJS.Timeout | null = null
      let resolved = false

      const cleanup = () => {
        if (timeout) {
          clearTimeout(timeout)
          timeout = null
        }
      }

      timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true
          cleanup()
          reject(new Error("Signaling channel subscribe timeout"))
        }
      }, 10000) // 10 секунд таймаут

      try {
        this.channel!.subscribe((status) => {
          if (resolved) return // Игнорировать статусы после разрешения промиса
          
          console.log(`[Signaling] Subscribe status: ${status}, channel state: ${this.channel?.state}`)
          
          if (status === "SUBSCRIBED") {
            if (!resolved) {
              resolved = true
              cleanup()
              console.debug("[Signaling] Channel subscribed successfully")
              resolve()
            }
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            if (!resolved) {
              resolved = true
              cleanup()
              reject(new Error(`Signaling channel subscribe failed: ${status}`))
            }
          } else if (status === "CLOSED") {
            // Если канал закрыт во время подписки, это нормально при размонтировании
            // Проверяем, не закрыт ли он намеренно (cleanup)
            if (!resolved) {
              const currentState = this.channel?.state
              if (currentState === "closed" || currentState === "channels_closed") {
                resolved = true
                cleanup()
                // Не бросаем ошибку, если канал закрыт - это может быть нормальный cleanup
                console.debug("[Signaling] Channel closed during subscription (likely cleanup)")
                resolve() // Разрешаем промис успешно, чтобы не вызывать ошибки
                return
              }
              // Если статус CLOSED, но канал еще не закрыт - это может быть временное состояние
              // Продолжаем ждать
            }
          }
          // Для статусов "JOINING" и других - просто ждем
        })
      } catch (err) {
        if (!resolved) {
          resolved = true
          cleanup()
          reject(err)
        }
      }
    })

    try {
      await subscribePromise
      // Проверить, что канал все еще существует и подключен
      if (this.channel && (this.channel.state === "joined" || this.channel.state === "joining")) {
        return this.channel
      }
      // Если канал закрыт после подписки, создать новый
      if (this.channel && (this.channel.state === "closed" || this.channel.state === "channels_closed")) {
        console.debug("[Signaling] Channel closed after subscription, reconnecting...")
        this.channel = null
        return this.connect(onSignal) // Рекурсивно переподключиться
      }
      return this.channel
    } catch (err) {
      // Если канал закрыт, очистить его
        const errorMessage = err instanceof Error ? err.message : String(err)
        if (errorMessage.includes("closed")) {
          console.debug("[Signaling] Channel closed during connection attempt")
          this.channel = null
          // Не бросаем ошибку, если это просто закрытие - попробуем переподключиться
          if (errorMessage.includes("cleanup") || errorMessage.includes("unmount")) {
            // Это нормальное закрытие при cleanup, не нужно пытаться переподключиться
            throw err
          }
        }
      throw err
    }
  }

  /**
   * Отправить сигнал другому игроку
   */
  async sendSignal(signal: Omit<WebRTCSignal, "roomId" | "from">) {
    if (!this.channel) {
      throw new Error("Channel not connected. Call connect() first.")
    }

    const channelState = this.channel.state
    if (channelState !== "joined" && channelState !== "joining") {
      console.warn(`[Signaling] Channel state is ${channelState}, attempting to reconnect before sending signal`)
      // Попробовать переподключиться
      if (this.onSignalCallback) {
        await this.connect(this.onSignalCallback)
      }
    }

    const fullSignal: WebRTCSignal = {
      ...signal,
      from: this.currentPlayerId,
      roomId: this.roomId,
    }
    
    console.log(`[Signaling] Sending signal: ${signal.type} to ${signal.to}`, {
      from: this.currentPlayerId,
      to: signal.to,
      channelState: this.channel.state,
      hasData: !!signal.data
    })

    await this.channel.send({
      type: "broadcast",
      event: "webrtc-signal",
      payload: fullSignal,
    })
    
    console.debug(`[Signaling] Signal sent successfully: ${signal.type} to ${signal.to}`)
  }

  /**
   * Отправить SDP offer
   */
  async sendOffer(to: string, offer: RTCSessionDescriptionInit) {
    await this.sendSignal({
      type: "offer",
      to,
      data: offer,
    })
  }

  /**
   * Отправить SDP answer
   */
  async sendAnswer(to: string, answer: RTCSessionDescriptionInit) {
    await this.sendSignal({
      type: "answer",
      to,
      data: answer,
    })
  }

  /**
   * Отправить ICE кандидат
   */
  async sendIceCandidate(to: string, candidate: RTCIceCandidateInit) {
    await this.sendSignal({
      type: "ice-candidate",
      to,
      data: candidate,
    })
  }

  /**
   * Отключиться от канала
   */
  async disconnect() {
    if (this.channel) {
      try {
        const state = this.channel.state
        // Не пытаться отписаться, если канал уже закрыт
        if (state !== "closed" && state !== "channels_closed") {
          await this.channel.unsubscribe()
        }
      } catch (err) {
        // Игнорировать ошибки при отписке (канал может быть уже закрыт)
        console.debug("[Signaling] Error during disconnect (ignored):", err)
      } finally {
        this.channel = null
        this.onSignalCallback = null
      }
    }
  }
}
