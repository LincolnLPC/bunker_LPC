/**
 * WebRTC Signaling через Socket.io
 * Более надежная альтернатива Supabase Realtime для signaling
 */

import { io, Socket } from "socket.io-client"

export interface WebRTCSignal {
  type: "offer" | "answer" | "ice-candidate"
  from: string // playerId отправителя
  to: string // playerId получателя
  data: RTCSessionDescriptionInit | RTCIceCandidateInit | null
  roomId: string
}

export class SocketIOSignaling {
  private socket: Socket | null = null
  private roomId: string
  private currentPlayerId: string
  private onSignalCallback: ((signal: WebRTCSignal) => void) | null = null
  private isConnecting: boolean = false
  private connectPromise: Promise<Socket> | null = null

  constructor(roomId: string, currentPlayerId: string) {
    this.roomId = roomId
    this.currentPlayerId = currentPlayerId
  }

  /**
   * Подключиться к Socket.io серверу
   */
  async connect(onSignal: (signal: WebRTCSignal) => void): Promise<Socket> {
    console.log(`[SocketIO] 🚀 connect() called`, {
      roomId: this.roomId,
      currentPlayerId: this.currentPlayerId,
      hasCallback: typeof onSignal === 'function',
      hasSocket: !!this.socket,
      socketConnected: this.socket?.connected,
      isConnecting: this.isConnecting,
    })
    
    // Если уже идет подключение, вернуть существующий промис
    if (this.isConnecting && this.connectPromise) {
      console.log(`[SocketIO] ⏳ Connection already in progress, returning existing promise`)
      return this.connectPromise
    }

    // Если сокет уже подключен, вернуть его
    if (this.socket && this.socket.connected) {
      console.log(`[SocketIO] ✅ Socket already connected, returning`)
      return this.socket
    }

    // Сохранить колбэк для обработки сигналов
    this.onSignalCallback = onSignal

    // Создать новый промис подключения
    this.isConnecting = true
    this.connectPromise = this._doConnect()
      .then((socket) => {
        this.isConnecting = false
        this.connectPromise = null
        return socket
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
  private async _doConnect(): Promise<Socket> {
    return new Promise((resolve, reject) => {
      try {
        // Создать новый сокет, если его нет или он отключен
        if (!this.socket || !this.socket.connected) {
          console.log(`[SocketIO] 🆕 Creating new socket connection for room: ${this.roomId}`)
          
          // Определить URL сервера (в разработке - localhost:3000, в продакшене - текущий домен)
          const serverUrl = typeof window !== 'undefined' 
            ? window.location.origin 
            : 'http://localhost:3000'
          
          this.socket = io(serverUrl, {
            path: '/api/socket',
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5,
            timeout: 20000,
          })

          // Таймаут для подключения (20 секунд)
          let timeout: NodeJS.Timeout | null = null
          let resolved = false

          const cleanup = () => {
            if (timeout) {
              clearTimeout(timeout)
              timeout = null
            }
          }

          // Обработка подтверждения присоединения к комнате (должен быть зарегистрирован до emit)
          this.socket.once('room-joined', (data: { roomId: string; playerId: string }) => {
            console.log(`[SocketIO] ✅ Room joined confirmed:`, data)
            if (!resolved && this.socket && this.socket.connected) {
              resolved = true
              cleanup()
              resolve(this.socket)
            }
          })

          // Обработка подключения
          const handleConnect = () => {
            console.log(`[SocketIO] ✅ Socket connected, ID: ${this.socket?.id}`)
            
            // Присоединиться к комнате
            if (this.socket) {
              this.socket.emit('join-room', {
                roomId: this.roomId,
                playerId: this.currentPlayerId,
              })
              console.log(`[SocketIO] 📡 Joined room: ${this.roomId}, player: ${this.currentPlayerId}`)
            }
          }

          // Если сокет уже подключен, присоединиться к комнате немедленно
          if (this.socket.connected) {
            console.log(`[SocketIO] ✅ Socket already connected, joining room immediately`)
            handleConnect()
          } else {
            // Ждать подключения, затем присоединиться к комнате
            this.socket.once('connect', handleConnect)
          }

          // Обработка отключения
          this.socket.on('disconnect', (reason) => {
            console.log(`[SocketIO] ⚠️ Socket disconnected: ${reason}`)
          })

          // Обработка ошибок подключения
          this.socket.on('connect_error', (error) => {
            console.error(`[SocketIO] ❌ Connection error:`, error)
            reject(error)
          })

          // Обработка сигналов WebRTC
          this.socket.on('webrtc-signal', (signal: WebRTCSignal) => {
            console.log(`[SocketIO] 📨 Received signal: ${signal.type} from ${signal.from} to ${signal.to} (current: ${this.currentPlayerId})`, {
              hasCallback: !!this.onSignalCallback,
              signalFrom: signal.from,
              signalTo: signal.to,
              currentPlayerId: this.currentPlayerId,
              isForUs: signal.to === this.currentPlayerId,
              isFromUs: signal.from === this.currentPlayerId,
            })
            
            // Принимаем сигналы только если они предназначены нам
            if (signal.to === this.currentPlayerId && signal.from !== this.currentPlayerId) {
              console.log(`[SocketIO] ✅ Processing signal: ${signal.type} from ${signal.from}`, {
                hasCallback: !!this.onSignalCallback,
                signalData: signal.data ? (signal.type === "ice-candidate" ? "ICE candidate" : "SDP") : "null"
              })
              if (this.onSignalCallback) {
                try {
                  this.onSignalCallback(signal)
                } catch (err) {
                  console.error(`[SocketIO] ❌ Error in signal callback:`, err)
                }
              } else {
                console.warn(`[SocketIO] ⚠️ No callback registered for signal from ${signal.from}`)
              }
            } else {
              console.log(`[SocketIO] ⚠️ Ignoring signal: not for us`, {
                to: signal.to,
                current: this.currentPlayerId,
                from: signal.from,
                isFromUs: signal.from === this.currentPlayerId,
              })
            }
          })

          // Установить таймаут для подключения (20 секунд)
          timeout = setTimeout(() => {
            if (!resolved) {
              resolved = true
              cleanup()
              console.error(`[SocketIO] ❌ Connection timeout after 20 seconds`)
              reject(new Error("Socket.io connection timeout"))
            }
          }, 20000)
        }

      } catch (err) {
        console.error(`[SocketIO] ❌ Error in _doConnect():`, err)
        reject(err)
      }
    })
  }

  /**
   * Отправить сигнал другому игроку
   */
  async sendSignal(signal: Omit<WebRTCSignal, "roomId" | "from">) {
    if (!this.socket || !this.socket.connected) {
      throw new Error("Socket not connected. Call connect() first.")
    }

    const fullSignal: WebRTCSignal = {
      ...signal,
      from: this.currentPlayerId,
      roomId: this.roomId,
    }
    
    console.log(`[SocketIO] 📤 Sending signal: ${signal.type} to ${signal.to}`, {
      from: this.currentPlayerId,
      to: signal.to,
      roomId: this.roomId,
      socketConnected: this.socket.connected,
      hasData: !!signal.data,
    })

    try {
      this.socket.emit('webrtc-signal', fullSignal)
      console.log(`[SocketIO] ✅ Signal sent successfully: ${signal.type} to ${signal.to}`)
    } catch (err) {
      console.error(`[SocketIO] ❌ Error sending signal: ${signal.type} to ${signal.to}:`, err)
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
   * Отключиться от сервера
   */
  async disconnect() {
    this.isConnecting = false
    this.connectPromise = null
    
    if (this.socket) {
      try {
        // Покинуть комнату перед отключением
        if (this.socket.connected) {
          this.socket.emit('leave-room', {
            roomId: this.roomId,
            playerId: this.currentPlayerId,
          })
        }
        this.socket.disconnect()
      } catch (err) {
        console.debug("[SocketIO] Error during disconnect (ignored):", err)
      } finally {
        this.socket = null
        this.onSignalCallback = null
      }
    }
  }
}
