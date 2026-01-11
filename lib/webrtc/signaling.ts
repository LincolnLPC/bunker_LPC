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
  private connectPromise: Promise<RealtimeChannel> | null = null
  private isConnecting: boolean = false

  constructor(roomId: string, currentPlayerId: string) {
    this.roomId = roomId
    this.currentPlayerId = currentPlayerId
  }

  /**
   * Подключиться к каналу сигналинга
   */
  async connect(onSignal: (signal: WebRTCSignal) => void): Promise<RealtimeChannel> {
    console.log(`[Signaling] 🚀 connect() called`, {
      roomId: this.roomId,
      currentPlayerId: this.currentPlayerId,
      hasCallback: typeof onSignal === 'function',
      hasChannel: !!this.channel,
      channelState: this.channel?.state,
      isConnecting: this.isConnecting,
      hasConnectPromise: !!this.connectPromise,
    })
    
    // Если уже идет подключение, вернуть существующий промис
    if (this.isConnecting && this.connectPromise) {
      console.log(`[Signaling] ⏳ Connection already in progress, returning existing promise`)
      return this.connectPromise
    }

    // Если канал уже подключен, вернуть его
    if (this.channel && this.channel.state === "joined") {
      console.log(`[Signaling] ✅ Channel already connected (joined), returning`)
      return this.channel
    }

    // Сохранить колбэк для обработки сигналов
    this.onSignalCallback = onSignal

    // Создать новый промис подключения
    this.isConnecting = true
    this.connectPromise = this._doConnect()
      .then((channel) => {
        this.isConnecting = false
        this.connectPromise = null
        return channel
      })
      .catch((err) => {
        this.isConnecting = false
        this.connectPromise = null
        throw err
      })

    return this.connectPromise
  }

  /**
   * Внутренний метод для выполнения подключения
   */
  private async _doConnect(): Promise<RealtimeChannel> {
    try {
      // Если канал в процессе подключения, подождать
      if (this.channel && this.channel.state === "joining") {
        console.log(`[Signaling] ⏳ Channel is joining, waiting...`)
        await new Promise((resolve) => setTimeout(resolve, 500))
        if (this.channel && this.channel.state === "joined") {
          console.log(`[Signaling] ✅ Channel joined after waiting`)
          return this.channel
        }
      }

      // Если канал закрыт или в неправильном состоянии, создать новый
      if (this.channel && (this.channel.state === "closed" || this.channel.state === "channels_closed" || this.channel.state === "CHANNEL_ERROR")) {
        console.log(`[Signaling] ⚠️ Channel is ${this.channel.state}, creating new channel`)
        try {
          await this.channel.unsubscribe()
        } catch (err) {
          // Игнорировать ошибки при отписке
          console.debug("[Signaling] Error unsubscribing old channel (ignored):", err)
        }
        this.channel = null
      }

      // Создать новый канал, если его нет
      if (!this.channel) {
        console.log(`[Signaling] 🆕 Creating new channel for room: ${this.roomId}`)
        this.channel = this.supabase.channel(`webrtc:${this.roomId}`, {
          config: {
            broadcast: { self: false },
          },
        })
        console.log(`[Signaling] ✅ Channel created, state: ${this.channel.state}`)

        // Слушаем сигналы WebRTC (только один раз при создании канала)
        this.channel.on("broadcast", { event: "webrtc-signal" }, ({ payload }) => {
          const signal = payload as WebRTCSignal
          console.log(`[Signaling] 📨 Received signal: ${signal.type} from ${signal.from} to ${signal.to} (current: ${this.currentPlayerId})`, {
            channelState: this.channel?.state,
            hasCallback: !!this.onSignalCallback,
            signalFrom: signal.from,
            signalTo: signal.to,
            currentPlayerId: this.currentPlayerId,
            isForUs: signal.to === this.currentPlayerId,
            isFromUs: signal.from === this.currentPlayerId,
          })
          // Принимаем сигналы только если они предназначены нам
          if (signal.to === this.currentPlayerId && signal.from !== this.currentPlayerId) {
            console.log(`[Signaling] ✅ Processing signal: ${signal.type} from ${signal.from}`, {
              hasCallback: !!this.onSignalCallback,
              signalData: signal.data ? (signal.type === "ice-candidate" ? "ICE candidate" : "SDP") : "null"
            })
            if (this.onSignalCallback) {
              try {
                this.onSignalCallback(signal)
              } catch (err) {
                console.error(`[Signaling] ❌ Error in signal callback:`, err)
              }
            } else {
              console.warn(`[Signaling] ⚠️ No callback registered for signal from ${signal.from}`)
            }
          } else {
            console.log(`[Signaling] ⚠️ Ignoring signal: not for us`, {
              to: signal.to,
              current: this.currentPlayerId,
              from: signal.from,
              isFromUs: signal.from === this.currentPlayerId,
            })
          }
        })
        console.log(`[Signaling] ✅ Channel event handler registered for room: ${this.roomId}, player: ${this.currentPlayerId}`)
      }

      // Проверить, что канал существует
      console.log(`[Signaling] 🔍 Checking channel state after creation/registration:`, {
        hasChannel: !!this.channel,
        channelState: this.channel?.state,
        channelTopic: this.channel?.topic,
      })
      
      if (!this.channel) {
        console.error("[Signaling] ❌ Channel is null after creation!")
        throw new Error("Channel is null after creation")
      }

      // Если канал уже подключен, вернуть его
      if (this.channel.state === "joined") {
        console.log("[Signaling] ✅ Channel already subscribed, returning")
        return this.channel
      }

      // Подписаться на канал и дождаться подключения
      console.log(`[Signaling] 📡 Starting subscription to channel, current state: ${this.channel.state}`, {
        channelTopic: this.channel.topic,
        roomId: this.roomId,
        currentPlayerId: this.currentPlayerId,
      })
      
      // Убедиться, что канал существует и готов к подписке
      if (!this.channel) {
        throw new Error("Channel is null before subscription")
      }

      const subscribePromise = new Promise<void>((resolve, reject) => {
        let timeout: NodeJS.Timeout | null = null
        let resolved = false
        let stateCheckInterval: NodeJS.Timeout | null = null

        const cleanup = () => {
          if (timeout) {
            clearTimeout(timeout)
            timeout = null
          }
          if (stateCheckInterval) {
            clearInterval(stateCheckInterval)
            stateCheckInterval = null
          }
        }

        timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true
            cleanup()
            console.error("[Signaling] ❌ Subscribe timeout after 10 seconds", {
              channelState: this.channel?.state,
              hasChannel: !!this.channel,
              channelTopic: this.channel?.topic,
            })
            reject(new Error("Signaling channel subscribe timeout"))
          }
        }, 10000) // 10 секунд таймаут

        try {
          const channelToSubscribe = this.channel
          if (!channelToSubscribe) {
            throw new Error("Channel is null when calling subscribe()")
          }
          
          console.log(`[Signaling] 📡 Calling subscribe() on channel, state before: ${channelToSubscribe.state}`, {
            channelTopic: channelToSubscribe.topic,
            channelState: channelToSubscribe.state,
          })
          
          // Начать периодическую проверку состояния канала (каждые 50ms)
          // Это поможет обнаружить, когда канал переходит в "joined" даже если callback не вызывается
          stateCheckInterval = setInterval(() => {
            if (!resolved && this.channel) {
              const currentState = this.channel.state
              if (currentState === "joined") {
                console.warn("[Signaling] ⚠️ Channel reached 'joined' state but callback not invoked, resolving manually (periodic check)")
                resolved = true
                cleanup()
                resolve()
              } else if (currentState === "closed" || currentState === "channels_closed") {
                console.warn("[Signaling] ⚠️ Channel closed during subscription (periodic check)")
                resolved = true
                cleanup()
                reject(new Error(`Channel closed during subscription: ${currentState}`))
              }
            }
          }, 50) // Проверять каждые 50ms
          
          channelToSubscribe.subscribe((status) => {
            console.log(`[Signaling] 📡 Subscribe callback invoked with status: ${status}`, {
              channelState: this.channel?.state,
              channelTopic: this.channel?.topic,
              resolved,
              timestamp: new Date().toISOString(),
            })
            
            if (resolved) {
              console.debug(`[Signaling] Ignoring status ${status} (already resolved)`)
              return
            }
            
            console.log(`[Signaling] 📡 Processing subscribe status: ${status}, channel state: ${this.channel?.state}`)
            
            if (status === "SUBSCRIBED") {
              resolved = true
              cleanup()
              console.log("[Signaling] ✅ Channel subscribed successfully (SUBSCRIBED status)", {
                channelState: this.channel?.state,
              })
              resolve()
            } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              resolved = true
              cleanup()
              console.error(`[Signaling] ❌ Subscribe failed with status: ${status}`, {
                channelState: this.channel?.state,
              })
              reject(new Error(`Signaling channel subscribe failed: ${status}`))
            } else if (status === "CLOSED") {
              // Если канал закрыт во время подписки, проверить состояние
              const currentState = this.channel?.state
              console.log(`[Signaling] 📡 CLOSED status received, channel state: ${currentState}`)
              if (currentState === "closed" || currentState === "channels_closed") {
                resolved = true
                cleanup()
                console.debug("[Signaling] Channel closed during subscription (likely cleanup)")
                resolve() // Разрешаем промис успешно для cleanup
                return
              }
              // Если статус CLOSED, но канал еще не закрыт - продолжаем ждать
            } else {
              // Для других статусов (JOINING и т.д.) - просто логируем и ждем
              console.log(`[Signaling] 📡 Waiting for subscription, status: ${status}`, {
                channelState: this.channel?.state,
              })
            }
          })
          console.log(`[Signaling] 📡 subscribe() called, waiting for status updates...`, {
            channelState: channelToSubscribe.state,
            channelTopic: channelToSubscribe.topic,
          })
          
          // Немедленная проверка после вызова subscribe() - иногда канал уже в "joined" состоянии
          // Это может произойти, если канал был создан ранее и уже подключен
          setTimeout(() => {
            if (!resolved && this.channel && this.channel.state === "joined") {
              console.warn("[Signaling] ⚠️ Channel already 'joined' immediately after subscribe() call, resolving manually")
              resolved = true
              cleanup()
              resolve()
            }
          }, 0) // Проверить в следующем тике event loop
          
          // Проверить состояние канала через 100ms после вызова subscribe()
          setTimeout(() => {
            if (!resolved && this.channel) {
              console.log(`[Signaling] 📡 Channel state 100ms after subscribe(): ${this.channel.state}`, {
                channelTopic: this.channel.topic,
                resolved,
              })
              // Если канал уже в состоянии "joined", но callback не был вызван, разрешить промис вручную
              if (this.channel.state === "joined" && !resolved) {
                console.warn("[Signaling] ⚠️ Channel is 'joined' but callback not invoked, resolving manually (100ms check)")
                resolved = true
                cleanup()
                resolve()
              }
            }
          }, 100)
          
          // Дополнительная проверка через 500ms
          setTimeout(() => {
            if (!resolved && this.channel) {
              console.log(`[Signaling] 📡 Channel state 500ms after subscribe(): ${this.channel.state}`, {
                channelTopic: this.channel.topic,
                resolved,
              })
              // Если канал в состоянии "joined", но callback не был вызван, разрешить промис вручную
              if (this.channel.state === "joined" && !resolved) {
                console.warn("[Signaling] ⚠️ Channel is 'joined' but callback not invoked after 500ms, resolving manually")
                resolved = true
                cleanup()
                resolve()
              }
            }
          }, 500)
          
          // Дополнительная проверка через 1 секунду
          setTimeout(() => {
            if (!resolved && this.channel) {
              console.log(`[Signaling] 📡 Channel state 1s after subscribe(): ${this.channel.state}`, {
                channelTopic: this.channel.topic,
                resolved,
              })
              // Если канал в состоянии "joined", но callback не был вызван, разрешить промис вручную
              if (this.channel.state === "joined" && !resolved) {
                console.warn("[Signaling] ⚠️ Channel is 'joined' but callback not invoked after 1s, resolving manually")
                resolved = true
                cleanup()
                resolve()
              }
            }
          }, 1000)
        } catch (err) {
          console.error("[Signaling] ❌ Error calling subscribe():", err, {
            errorName: err instanceof Error ? err.name : "Unknown",
            errorMessage: err instanceof Error ? err.message : String(err),
            channelState: this.channel?.state,
            hasChannel: !!this.channel
          })
          if (!resolved) {
            resolved = true
            cleanup()
            reject(err)
          }
        }
      })

      // Дождаться завершения подписки
      console.log("[Signaling] ⏳ Waiting for subscribe promise to resolve...")
      await subscribePromise
      console.log("[Signaling] ✅ Subscribe promise resolved, checking channel state:", this.channel?.state)
      
      // Дождаться, пока канал действительно подключится (state === "joined")
      // Проверять состояние канала каждые 100мс, максимум 10 секунд
      const maxWaitTime = 10000 // 10 секунд
      const checkInterval = 100 // 100мс
      const startTime = Date.now()
      
      while (this.channel && this.channel.state !== "joined") {
        const elapsed = Date.now() - startTime
        if (elapsed > maxWaitTime) {
          console.warn("[Signaling] ⚠️ Channel did not reach 'joined' state within timeout", {
            finalState: this.channel?.state,
            elapsed
          })
          throw new Error(`Signaling channel did not reach 'joined' state within ${maxWaitTime}ms. Final state: ${this.channel?.state}`)
        }
        // Если канал закрыт, выйти из цикла
        if (this.channel.state === "closed" || this.channel.state === "channels_closed") {
          console.debug("[Signaling] Channel closed while waiting for 'joined' state")
          throw new Error("Signaling channel closed while waiting for 'joined' state")
        }
        // Подождать перед следующей проверкой
        await new Promise(resolve => setTimeout(resolve, checkInterval))
      }
      
      // Проверить, что канал все еще существует и подключен
      if (this.channel && this.channel.state === "joined") {
        console.log("[Signaling] ✅ Channel is now in 'joined' state")
        return this.channel
      }
      
      // Если мы дошли сюда, канал не в состоянии "joined" - это ошибка
      console.error(`[Signaling] ❌ Channel not in 'joined' state. Current state: ${this.channel?.state}`)
      throw new Error(`Signaling channel is not in 'joined' state. Current state: ${this.channel?.state}`)
    } catch (err) {
      // Обработка ошибок
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error(`[Signaling] ❌ Error in _doConnect() method:`, err, {
        errorName: err instanceof Error ? err.name : "Unknown",
        errorMessage,
        channelState: this.channel?.state,
        hasChannel: !!this.channel
      })
      
      // Если канал закрыт, очистить его
      if (errorMessage.includes("closed") && !errorMessage.includes("cleanup") && !errorMessage.includes("unmount")) {
        console.debug("[Signaling] Channel closed during connection attempt, will retry")
        this.channel = null
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
      console.warn(`[Signaling] ⚠️ Channel state is ${channelState}, attempting to reconnect before sending signal`)
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
    
    console.log(`[Signaling] 📤 Sending signal: ${signal.type} to ${signal.to}`, {
      from: this.currentPlayerId,
      to: signal.to,
      roomId: this.roomId,
      channelState: this.channel.state,
      hasData: !!signal.data,
      channelTopic: this.channel.topic,
    })

    try {
      await this.channel.send({
        type: "broadcast",
        event: "webrtc-signal",
        payload: fullSignal,
      })
      
      console.log(`[Signaling] ✅ Signal sent successfully: ${signal.type} to ${signal.to}`, {
        channelState: this.channel.state,
      })
    } catch (err) {
      console.error(`[Signaling] ❌ Error sending signal: ${signal.type} to ${signal.to}:`, err, {
        channelState: this.channel.state,
        errorName: err instanceof Error ? err.name : "Unknown",
        errorMessage: err instanceof Error ? err.message : String(err),
      })
      throw err
    }
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
    // Сбросить флаги подключения
    this.isConnecting = false
    this.connectPromise = null
    
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
