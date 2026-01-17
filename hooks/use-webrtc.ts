"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { SocketIOSignaling } from "@/lib/webrtc/socket-signaling"
import { PeerConnectionManager } from "@/lib/webrtc/peer-connection"
import type { WebRTCSignal } from "@/lib/webrtc/socket-signaling"
import { handleMediaError } from "@/lib/error-handling/connection-recovery"
import type { MediaSettings } from "@/hooks/use-media-settings"

interface UseWebRTCOptions {
  roomId: string
  userId: string
  currentPlayerId?: string
  otherPlayers: Array<{ id: string; playerId: string }> // Список других игроков в комнате
  mediaSettings?: MediaSettings
}

export function useWebRTC({ roomId, userId, currentPlayerId, otherPlayers, mediaSettings }: UseWebRTCOptions) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map())
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [videoEnabled, setVideoEnabled] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connectionStates, setConnectionStates] = useState<Map<string, RTCPeerConnectionState>>(new Map())
  const [signalingConnected, setSignalingConnected] = useState(false)

  const signalingRef = useRef<SocketIOSignaling | null>(null)
  const peerConnectionsRef = useRef<Map<string, PeerConnectionManager>>(new Map())
  const pendingOffersRef = useRef<Map<string, RTCSessionDescriptionInit>>(new Map())
  const isInitiatorRef = useRef<Map<string, boolean>>(new Map())
  const isCreatingOfferRef = useRef<Map<string, boolean>>(new Map()) // Защита от одновременных вызовов createOffer
  const lastOtherPlayersIdsRef = useRef<string>("")
  const isInitialMountRef = useRef(true)
  const handleWebRTCSignalRef = useRef<((signal: WebRTCSignal) => Promise<void>) | null>(null)

  // Create stable reference to player IDs to avoid infinite loops
  const otherPlayerIds = useMemo(() => {
    const ids = otherPlayers.map((p) => p.playerId || p.id).filter(Boolean).sort().join(",")
    console.log("[WebRTC] otherPlayerIds computed:", {
      otherPlayers: otherPlayers.map(p => ({ id: p.id, playerId: p.playerId })),
      ids,
    })
    return ids
  }, [otherPlayers])

  // Initialize local media stream
  const initializeMedia = useCallback(async (options?: { video?: boolean; audio?: boolean }) => {
    // Определяем переменные вне try-catch, чтобы они были доступны в catch
    const requestVideo = options?.video !== false
    const requestAudio = options?.audio !== false
    let videoConstraints: MediaTrackConstraints | boolean = false
    let audioConstraints: MediaTrackConstraints | boolean = false
    
    try {
      // Если указан VDO.ninja URL, пропускаем getUserMedia для видео
      // VDO.ninja будет отображаться через iframe в PlayerCard
      if (mediaSettings?.vdoNinjaCameraUrl && requestVideo) {
        console.log("[WebRTC] VDO.ninja camera URL detected:", mediaSettings.vdoNinjaCameraUrl)
        console.log("[WebRTC] VDO.ninja will be displayed via iframe in PlayerCard. Skipping getUserMedia for video.")
        
        // Если нужно только видео, возвращаем null (iframe будет показан в PlayerCard)
        if (!requestAudio) {
          return null
        }
        
        // Если нужен также аудио, продолжаем только для аудио
        console.log("[WebRTC] Requesting audio only (video via VDO.ninja iframe)")
      }

      // Check if browser supports getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const errorMsg = "Ваш браузер не поддерживает доступ к камере/микрофону"
        // Не устанавливаем ошибку в состояние - это не критично, игра может работать без видео
        console.warn("[WebRTC] Browser doesn't support getUserMedia - video/audio will be unavailable")
        // Возвращаем null вместо выброса ошибки, чтобы приложение продолжало работать
        return null
      }

      // Проверка статуса разрешений (если поддерживается)
      try {
        if (navigator.permissions && navigator.permissions.query) {
          console.log("[WebRTC] Checking permission status...")
          const cameraPermission = await navigator.permissions.query({ name: 'camera' as PermissionName })
          const microphonePermission = await navigator.permissions.query({ name: 'microphone' as PermissionName })
          
          console.log("[WebRTC] Permission status:", {
            camera: cameraPermission.state,
            microphone: microphonePermission.state,
            cameraBlocked: cameraPermission.state === 'denied',
            microphoneBlocked: microphonePermission.state === 'denied',
          })
          
          if (cameraPermission.state === 'denied' || microphonePermission.state === 'denied') {
            console.warn("[WebRTC] ⚠️ Permissions are BLOCKED (denied). User needs to reset permissions in browser settings.")
            const message = "Доступ к камере/микрофону заблокирован в настройках браузера. Пожалуйста, разрешите доступ в настройках браузера и обновите страницу."
            setError(message)
            return null
          }
        }
      } catch (permError) {
        // Permissions API может не поддерживаться или не работать - это нормально
        console.log("[WebRTC] Permissions API not available or failed (this is OK):", permError)
      }

      // Проверка доступных устройств (для диагностики)
      console.log("[WebRTC] Checking available devices...")
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const videoDevices = devices.filter(d => d.kind === 'videoinput')
        const audioDevices = devices.filter(d => d.kind === 'audioinput')
        console.log("[WebRTC] Available devices:", {
          videoDevices: videoDevices.length,
          audioDevices: audioDevices.length,
          videoDeviceLabels: videoDevices.map(d => ({ id: d.deviceId, label: d.label || 'No label (permission not granted)' })),
          audioDeviceLabels: audioDevices.map(d => ({ id: d.deviceId, label: d.label || 'No label (permission not granted)' })),
        })
        
        // Если устройства без label, это означает, что разрешение еще не предоставлено
        if (videoDevices.length > 0 && videoDevices.every(d => !d.label)) {
          console.warn("[WebRTC] Video devices found but no labels - permission may not be granted")
        }
        if (audioDevices.length > 0 && audioDevices.every(d => !d.label)) {
          console.warn("[WebRTC] Audio devices found but no labels - permission may not be granted")
        }
      } catch (enumError) {
        console.warn("[WebRTC] Error enumerating devices (this is OK if permission not granted yet):", enumError)
      }

      // Подготовить constraints для видео
      videoConstraints = requestVideo
        ? {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "user",
            ...(mediaSettings?.cameraDeviceId && { deviceId: { ideal: mediaSettings.cameraDeviceId } }),
          }
        : false

      // Подготовить constraints для аудио
      audioConstraints = requestAudio
        ? {
            echoCancellation: true,
            noiseSuppression: true,
            ...(mediaSettings?.microphoneDeviceId && { deviceId: { ideal: mediaSettings.microphoneDeviceId } }),
          }
        : false

      console.log("[WebRTC] 📹 Requesting camera and microphone access...", {
        video: requestVideo,
        audio: requestAudio,
        videoConstraints: typeof videoConstraints === 'object' ? JSON.stringify(videoConstraints) : videoConstraints,
        audioConstraints: typeof audioConstraints === 'object' ? JSON.stringify(audioConstraints) : audioConstraints,
        cameraDeviceId: mediaSettings?.cameraDeviceId,
        microphoneDeviceId: mediaSettings?.microphoneDeviceId,
        userAgent: navigator.userAgent,
        isSecureContext: window.isSecureContext,
        location: window.location.href,
      })
      
      console.log("[WebRTC] Calling getUserMedia now...")
      
      // Добавляем таймаут для getUserMedia (максимум 15 секунд для медленных камер)
      const getUserMediaPromise = navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: audioConstraints,
      })
      
      const timeoutMs = 15000 // 15 секунд таймаут (увеличено для медленных камер)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new DOMException("Timeout starting video/audio source. Camera might be busy or not responding.", "AbortError"))
        }, timeoutMs)
      })
      
      const stream = await Promise.race([getUserMediaPromise, timeoutPromise])
      console.log("[WebRTC] ✅ getUserMedia succeeded, got stream:", stream.id)
      
      console.log("[WebRTC] ✅ Media access granted, stream obtained:", {
        streamId: stream.id,
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length,
        videoTracksInfo: stream.getVideoTracks().map(t => ({
          id: t.id,
          label: t.label,
          enabled: t.enabled,
          readyState: t.readyState,
          muted: t.muted,
          settings: t.getSettings(),
        })),
        audioTracksInfo: stream.getAudioTracks().map(t => ({
          id: t.id,
          label: t.label,
          enabled: t.enabled,
          readyState: t.readyState,
          muted: t.muted,
          settings: t.getSettings(),
        })),
      })
      
      // Проверка, что stream не пустой
      if (stream.getVideoTracks().length === 0 && requestVideo) {
        console.warn("[WebRTC] ⚠️ Video was requested but stream has no video tracks!")
      }
      if (stream.getAudioTracks().length === 0 && requestAudio) {
        console.warn("[WebRTC] ⚠️ Audio was requested but stream has no audio tracks!")
      }
      setLocalStream(stream)
      setError(null)
      
      // Add event listeners for track ended events (device disconnected)
      stream.getTracks().forEach((track) => {
        track.onended = () => {
          console.warn(`[WebRTC] Track ended: ${track.kind}`, track.label)
          if (track.kind === "video") {
            setError("Видеокамера отключена")
          } else if (track.kind === "audio") {
            setError("Микрофон отключен")
          }
        }

        track.onerror = (event) => {
          console.error(`[WebRTC] Track error: ${track.kind}`, event)
          const { message } = handleMediaError(event)
          setError(message)
        }
      })
      
      return stream
    } catch (err: unknown) {
      // Сначала логируем саму ошибку
      console.error("[WebRTC] ❌ Raw error caught:", err)
      console.log("[WebRTC] Error diagnostic info:", {
        type: typeof err,
        isError: err instanceof Error,
        isDOMException: err instanceof DOMException,
      })
      
      // Извлекаем информацию об ошибке
      let errorName = "Unknown"
      let errorMessage = String(err)
      let errorCode: number | undefined = undefined
      let errorStack: string | undefined = undefined
      
      if (err instanceof DOMException) {
        errorName = err.name
        errorMessage = err.message
        errorCode = err.code
      } else if (err instanceof Error) {
        errorName = err.name
        errorMessage = err.message
        errorStack = err.stack
      } else if (err && typeof err === 'object') {
        // Попробуем извлечь свойства напрямую
        errorName = (err as any).name || (err as any).errorName || "Unknown"
        errorMessage = (err as any).message || (err as any).errorMessage || String(err)
        errorCode = (err as any).code || (err as any).errorCode
        errorStack = (err as any).stack || (err as any).errorStack
      }
      
      // Детальное логирование ошибки (упрощенный объект, чтобы избежать проблем с сериализацией)
      const errorDetails = {
        errorName,
        errorMessage,
        errorCode,
        errorStack: errorStack ? errorStack.substring(0, 200) : undefined, // Ограничиваем длину stack trace
        requestVideo,
        requestAudio,
        hasMediaSettings: !!mediaSettings,
        cameraDeviceId: mediaSettings?.cameraDeviceId || null,
        microphoneDeviceId: mediaSettings?.microphoneDeviceId || null,
        // Не включаем constraints напрямую, так как они могут быть объектами, которые не сериализуются
        hasVideoConstraints: !!videoConstraints,
        hasAudioConstraints: !!audioConstraints,
      }
      
      // Отправляем ошибку на сервер для логирования
      try {
        await fetch('/api/log/error', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: errorMessage,
            error: {
              name: errorName,
              message: errorMessage,
              code: errorCode,
              stack: errorStack,
            },
            stack: errorStack,
            url: typeof window !== 'undefined' ? window.location.href : undefined,
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
            timestamp: new Date().toISOString(),
          }),
        }).catch(err => {
          // Игнорируем ошибки отправки логов на сервер
          console.debug("[WebRTC] Failed to send error log to server:", err)
        })
      } catch (logError) {
        // Игнорируем ошибки логирования
        console.debug("[WebRTC] Error logging failed:", logError)
      }
      
      // Check if it's a permission error (NotAllowedError)
      const isPermissionError = 
        errorName === "NotAllowedError" ||
        errorMessage.includes("Permission denied") ||
        errorMessage.includes("permission")
      
      console.log("[WebRTC] Permission error check:", {
        isPermissionError,
        errorName,
        errorMessage,
        errorNameMatches: errorName === "NotAllowedError",
        errorMessageIncludes: errorMessage.includes("Permission denied") || errorMessage.includes("permission"),
      })
      
      if (isPermissionError) {
        // Permission denied is not a critical error - user can retry manually
        const message = "Доступ к камере/микрофону запрещен. Вы можете включить их позже, нажав кнопку 'Включить камеру'."
        setError(message)
        console.warn("[WebRTC] ⚠️ Permission denied - user can enable media manually via button", {
          errorName: errorName,
          errorMessage: errorMessage,
          note: "This is normal if auto-request is blocked. User should click 'Enable Camera' button.",
        })
        return null
      }
      
      // Check if it's a NotReadableError (camera/microphone in use)
      const isNotReadableError = 
        errorName === "NotReadableError" ||
        errorMessage.includes("Could not start video source") ||
        errorMessage.includes("Could not start audio source")
      
      // Check if it's a timeout error (AbortError with timeout message)
      const isTimeoutError = 
        errorName === "AbortError" &&
        (errorMessage.includes("Timeout") || errorMessage.includes("timeout"))
      
      if (isNotReadableError || isTimeoutError) {
        // NotReadableError and timeout errors are recoverable - camera might be busy, user can retry
        const message = isTimeoutError
          ? "Таймаут при запуске камеры/микрофона. Камера может быть занята или долго не отвечает. Это не критично - игра продолжит работать без видеосвязи. Вы можете попробовать включить камеру позже, нажав кнопку 'Включить камеру'."
          : "Камера или микрофон заняты другим приложением. Закройте другие приложения, использующие камеру, и попробуйте снова, нажав кнопку 'Включить камеру'. Это не критично - игра продолжит работать без видеосвязи."
        setError(message)
        // Для recoverable ошибок используем console.warn, а не console.error
        console.warn(`[WebRTC] ⚠️ ${isTimeoutError ? 'Timeout' : 'NotReadableError'} - camera/microphone might be in use or slow to respond. This is not critical - game will continue without video/audio.`, errorDetails)
        return null
      }
      
      // For other errors, use the standard error handler
      const { message, recoverable } = handleMediaError(err)
      setError(message)
      
      // Log as warning for recoverable errors, error for non-recoverable
      if (recoverable) {
        console.warn("[WebRTC] ⚠️ Media initialization failed (recoverable):", errorDetails)
      } else {
        console.error("[WebRTC] ❌ Media initialization failed (non-recoverable):", errorDetails)
      }
      
      return null
    }
  }, [mediaSettings])

  // Инициализация сигналинга
  useEffect(() => {
    console.log("[WebRTC] 🔄 Signaling initialization effect triggered:", {
      roomId,
      currentPlayerId,
      roomIdType: typeof roomId,
      currentPlayerIdType: typeof currentPlayerId,
      roomIdLength: roomId?.length,
      currentPlayerIdLength: currentPlayerId?.length,
    })
    
    // Проверяем, что roomId и currentPlayerId не пустые строки
    if (!roomId || !currentPlayerId || roomId.trim() === "" || currentPlayerId.trim() === "") {
      console.warn("[WebRTC] ⚠️ Cannot initialize signaling:", { 
        roomId, 
        currentPlayerId,
        roomIdEmpty: !roomId || roomId.trim() === "",
        currentPlayerIdEmpty: !currentPlayerId || currentPlayerId.trim() === ""
      })
      setSignalingConnected(false)
      return
    }

    console.log("[WebRTC] 🔌 Initializing signaling for room:", roomId, "player:", currentPlayerId)
    const signaling = new SocketIOSignaling(roomId, currentPlayerId)
    signalingRef.current = signaling

    // Подключиться к каналу и обработать сигналы
    let isMounted = true
    let connectPromise: Promise<any> | null = null
    let retryCount = 0
    const maxRetries = 3
    let isConnecting = false

    const attemptConnect = (): Promise<any> => {
      // Предотвратить множественные одновременные попытки подключения
      if (isConnecting) {
        console.log("[WebRTC] ⏳ Connection attempt already in progress, skipping...")
        return Promise.resolve(null)
      }
      
      isConnecting = true
      console.log(`[WebRTC] 🔌 Connecting to signaling channel... (attempt ${retryCount + 1}/${maxRetries})`, {
        roomId,
        currentPlayerId,
        hasSignaling: !!signaling,
        signalingRef: !!signalingRef.current
      })
      const connectStartTime = Date.now()
      
      // Добавить таймаут для connect() - максимум 15 секунд
      const connectWithTimeout = Promise.race([
        signaling.connect((signal: WebRTCSignal) => {
          if (isMounted && handleWebRTCSignalRef.current) {
            handleWebRTCSignalRef.current(signal)
          } else if (isMounted) {
            console.warn("[WebRTC] ⚠️ handleWebRTCSignal callback not available yet, signal will be lost:", signal.type)
          }
        }),
        new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error("Signaling connect() timeout after 15 seconds"))
          }, 15000)
        })
      ])
      
      return connectWithTimeout
        .then((channel) => {
          isConnecting = false
          const connectDuration = Date.now() - connectStartTime
          if (isMounted) {
            // Socket.io Socket имеет свойство 'connected' (boolean), а не 'state'
            const isConnected = (channel as any)?.connected === true
            
            console.log("[WebRTC] ✅ Signaling channel connect() resolved", {
              socketConnected: isConnected,
              hasSocket: !!channel,
              socketId: (channel as any)?.id,
              attempt: retryCount + 1,
              duration: `${connectDuration}ms`
            })
            
            // Если промис резолвился, сокет должен быть подключен
            // (socket-signaling.ts гарантирует это)
            if (channel && isConnected) {
              console.log("[WebRTC] ✅ Signaling socket confirmed connected")
              setSignalingConnected(true)
              setError(null) // Очистить предыдущие ошибки
            } else {
              console.error("[WebRTC] ❌ Socket not connected after connect():", {
                hasSocket: !!channel,
                connected: isConnected,
                socketId: (channel as any)?.id
              })
              setError("Signaling socket connection failed: socket not connected")
              // Не устанавливаем signalingConnected, если сокет не подключен
              setSignalingConnected(false)
            }
          }
          return channel
        })
        .catch((err) => {
          isConnecting = false
          // Игнорировать ошибки закрытия канала при размонтировании
          if (!isMounted) {
            return
          }
          
          const errorMessage = err instanceof Error ? err.message : String(err)
          // Игнорируем ошибки, связанные с закрытием канала во время cleanup
          if (errorMessage.includes("closed") && 
              (errorMessage.includes("cleanup") || 
               errorMessage.includes("CLOSED") ||
               errorMessage.includes("unmount"))) {
            // Это нормальное закрытие при cleanup, не показываем ошибку
            console.log("[WebRTC] Signaling channel closed (expected during cleanup):", errorMessage)
            setSignalingConnected(false)
            throw err // Не ретраить
          }
          
          // Для других ошибок - попробовать ретраить
          retryCount++
          if (retryCount < maxRetries) {
            console.warn(`[WebRTC] ⚠️ Signaling connection failed (attempt ${retryCount}), retrying...`, {
              errorName: err instanceof Error ? err.name : "Unknown",
              errorMessage
            })
            // Подождать перед ретраем (экспоненциальная задержка)
            return new Promise(resolve => setTimeout(resolve, 1000 * retryCount))
              .then(() => attemptConnect())
          } else {
            // Все ретраи исчерпаны
            console.error("[WebRTC] ❌ Error connecting to signaling (all retries exhausted):", err, {
              errorName: err instanceof Error ? err.name : "Unknown",
              errorMessage,
              attempts: retryCount
            })
            setError(`Failed to connect to signaling server after ${retryCount} attempts: ${errorMessage}`)
            setSignalingConnected(false)
            throw err
          }
        })
    }

    connectPromise = attemptConnect()

    return () => {
      isMounted = false
      isConnecting = false
      setSignalingConnected(false)
      // Дождаться завершения подключения перед отключением
      Promise.resolve(connectPromise).finally(() => {
        signaling.disconnect().catch((err) => {
          // Игнорировать ошибки при отключении
          console.log("[WebRTC] Error during disconnect (ignored):", err)
        })
      })
    }
  }, [roomId, currentPlayerId])

  // Обработка WebRTC сигналов
  const handleWebRTCSignal = useCallback(
    async (signal: WebRTCSignal) => {
      console.log(`[WebRTC] 🔔 handleWebRTCSignal called:`, {
        signalType: signal.type,
        from: signal.from,
        to: signal.to,
        currentPlayerId,
        isFromUs: signal.from === currentPlayerId,
        isForUs: signal.to === currentPlayerId,
      })
      
      if (!currentPlayerId) {
        console.warn(`[WebRTC] ⚠️ No currentPlayerId, ignoring signal`)
        return
      }
      // Игнорируем сигналы от себя и сигналы, не предназначенные нам
      if (signal.from === currentPlayerId || signal.to !== currentPlayerId) {
        console.log(`[WebRTC] ⚠️ Ignoring signal: from=${signal.from}, to=${signal.to}, current=${currentPlayerId}`)
        return
      }

      console.log(`[WebRTC] ✅ Processing signal: ${signal.type} from ${signal.from} to ${signal.to}`)

      let peerManager = peerConnectionsRef.current.get(signal.from)

      // Создать peer connection если его нет
      if (!peerManager) {
        console.log(`[WebRTC] 🔌 Creating new peer connection for ${signal.from} (received ${signal.type})`, {
          hasLocalStream: !!localStream,
          signalingConnected,
          currentPlayerId,
          signalType: signal.type,
        })
        peerManager = new PeerConnectionManager({
          playerId: signal.from,
          onStream: (stream) => {
            console.log(`[WebRTC] ✅ Received remote stream from ${signal.from} (via signal):`, {
              streamId: stream.id,
              videoTracks: stream.getVideoTracks().length,
              audioTracks: stream.getAudioTracks().length,
              videoEnabled: stream.getVideoTracks().some(t => t.enabled),
              audioEnabled: stream.getAudioTracks().some(t => t.enabled),
              trackIds: stream.getTracks().map(t => ({ id: t.id, kind: t.kind, enabled: t.enabled, readyState: t.readyState })),
            })
            setRemoteStreams((prev) => {
              const next = new Map(prev)
              next.set(signal.from, stream)
              console.log(`[WebRTC] ✅ Updated remoteStreams map (via signal), now has ${next.size} streams. Keys:`, Array.from(next.keys()))
              return next
            })
          },
          onIceCandidate: async (candidate) => {
            if (signalingRef.current) {
              try {
                // Убедиться, что канал подключен перед отправкой
                await signalingRef.current.connect((signal: WebRTCSignal) => {
                  if (handleWebRTCSignalRef.current) {
                    handleWebRTCSignalRef.current(signal)
                  }
                })
                console.log(`[WebRTC] 🧊 Sending ICE candidate to ${signal.from}`)
                await signalingRef.current.sendIceCandidate(signal.from, candidate.toJSON())
                console.log(`[WebRTC] ✅ ICE candidate sent to ${signal.from}`)
              } catch (err) {
                console.error(`[WebRTC] ❌ Error sending ICE candidate to ${signal.from}:`, err)
              }
            }
          },
          onConnectionStateChange: (state) => {
            console.log(`[WebRTC] 🔄 Connection state changed for ${signal.from}: ${state}`)
            setConnectionStates((prev) => {
              const next = new Map(prev)
              next.set(signal.from, state)
              return next
            })
          },
        })

        // ВАЖНО: Добавить локальный поток ПЕРЕД обработкой сигнала
        // Это необходимо для правильного SDP negotiation
        if (localStream) {
          peerManager.addLocalStream(localStream)
          console.log(`[WebRTC] ➕ Added local stream to peer connection for ${signal.from} (via signal)`)
        } else {
          console.log(`[WebRTC] ℹ️ No local stream available for ${signal.from}, will only receive remote stream`)
        }

        peerConnectionsRef.current.set(signal.from, peerManager)
        console.log(`[WebRTC] ✅ Peer connection created and stored for ${signal.from}`)
      } else {
        console.log(`[WebRTC] ℹ️ Peer connection already exists for ${signal.from}`)
      }

      // Обработать сигнал
      if (signal.type === "offer") {
        console.log(`[WebRTC] 📥 Handling offer from ${signal.from}`, {
          localStreamAvailable: !!localStream,
          hasPeerManager: !!peerManager,
          signalData: signal.data ? (signal.data.type || "unknown") : "null",
        })
        // ВАЖНО: Добавить локальный поток ПЕРЕД обработкой offer, если он есть
        // Если локального потока нет - это нормально, мы все равно можем получать удаленные потоки
        if (localStream) {
          const hasTracks = peerManager.getPeerConnection().getSenders().some(s => s.track)
          if (!hasTracks) {
            console.log(`[WebRTC] ➕ Adding local stream to peer connection for ${signal.from} before handling offer`)
            peerManager.addLocalStream(localStream)
          } else {
            console.debug(`[WebRTC] Peer connection for ${signal.from} already has tracks`)
          }
        } else {
          console.log(`[WebRTC] ℹ️ No local stream available, but will still receive remote stream from ${signal.from}`)
        }
        
        // Обработать offer и создать answer (даже без локального потока)
        console.log(`[WebRTC] 🔄 Creating answer for offer from ${signal.from}...`)
        const answer = await peerManager.handleOffer(signal.data as RTCSessionDescriptionInit)
        console.log(`[WebRTC] ✅ Answer created for ${signal.from}`, {
          answerType: answer.type,
          hasSdp: !!answer.sdp,
        })
        if (signalingRef.current) {
          try {
            // Убедиться, что канал подключен перед отправкой
            await signalingRef.current.connect((signal: WebRTCSignal) => {
              if (handleWebRTCSignalRef.current) {
                handleWebRTCSignalRef.current(signal)
              }
            })
            console.log(`[WebRTC] 📤 Sending answer to ${signal.from} via Socket.io`)
            await signalingRef.current.sendAnswer(signal.from, answer)
            console.log(`[WebRTC] ✅ Answer sent successfully to ${signal.from}`)
          } catch (err) {
            console.error(`[WebRTC] ❌ Error sending answer to ${signal.from}:`, err)
          }
        } else {
          console.error(`[WebRTC] ❌ No signaling ref available to send answer to ${signal.from}`)
        }
      } else if (signal.type === "answer") {
        console.log(`[WebRTC] 📥 Handling answer from ${signal.from}`, {
          localStreamAvailable: !!localStream,
          hasPeerManager: !!peerManager,
          signalData: signal.data ? (signal.data.type || "unknown") : "null",
        })
        
        const connectionStateBefore = peerManager.getConnectionState()
        const iceStateBefore = peerManager.getIceConnectionState()
        const signalingStateBefore = peerManager.getPeerConnection().signalingState
        const localDescBefore = peerManager.getPeerConnection().localDescription
        const remoteDescBefore = peerManager.getPeerConnection().remoteDescription
        
        console.log(`[WebRTC] 📊 Connection state before handling answer:`, {
          connection: connectionStateBefore,
          ice: iceStateBefore,
          signaling: signalingStateBefore,
          localDescription: localDescBefore ? { type: localDescBefore.type } : null,
          remoteDescription: remoteDescBefore ? { type: remoteDescBefore.type } : null,
        })
        
        // Проверить, что мы в правильном состоянии для обработки answer
        // Answer можно обработать только когда:
        // 1. У нас есть local description типа 'offer' (have-local-offer)
        // 2. Или мы в состоянии 'stable' и еще нет remote description
        // НЕЛЬЗЯ обрабатывать answer, если мы в состоянии 'have-remote-offer' (это означает, что мы получили offer и должны создать answer)
        if (signalingStateBefore === "have-remote-offer") {
          console.warn(`[WebRTC] ⚠️ Cannot handle answer from ${signal.from}: we are in 'have-remote-offer' state, we should create an answer first, not handle a remote answer`, {
            signalingState: signalingStateBefore,
            localDescription: localDescBefore ? { type: localDescBefore.type } : null,
            remoteDescription: remoteDescBefore ? { type: remoteDescBefore.type } : null,
          })
          return
        }
        
        // Проверить, что у нас есть local offer перед обработкой remote answer
        if (signalingStateBefore !== "have-local-offer" && signalingStateBefore !== "stable") {
          console.warn(`[WebRTC] ⚠️ Cannot handle answer from ${signal.from}: wrong signaling state '${signalingStateBefore}', expected 'have-local-offer' or 'stable'`, {
            signalingState: signalingStateBefore,
            localDescription: localDescBefore ? { type: localDescBefore.type } : null,
            remoteDescription: remoteDescBefore ? { type: remoteDescBefore.type } : null,
          })
          return
        }
        
        // Проверить, что remote description еще не установлена
        if (remoteDescBefore && remoteDescBefore.type === "answer") {
          console.warn(`[WebRTC] ⚠️ Remote answer already set for ${signal.from}, skipping`, {
            signalingState: signalingStateBefore,
            existingRemoteDescription: { type: remoteDescBefore.type },
          })
          return
        }
        
        try {
          await peerManager.handleAnswer(signal.data as RTCSessionDescriptionInit)
        } catch (error) {
          // Детальное логирование ошибки
          let errorDetails: any = {
            signalingState: signalingStateBefore,
            localDescription: localDescBefore ? { type: localDescBefore.type } : null,
            remoteDescription: remoteDescBefore ? { type: remoteDescBefore.type } : null,
          }
          
          if (error instanceof Error) {
            errorDetails.errorMessage = error.message
            errorDetails.errorName = error.name
            errorDetails.errorStack = error.stack
            if ('code' in error) {
              errorDetails.errorCode = (error as any).code
            }
          } else {
            errorDetails.error = String(error)
            errorDetails.errorType = typeof error
          }
          
          console.error(`[WebRTC] ❌ Error handling answer from ${signal.from}:`, errorDetails)
          
          // Также логируем саму ошибку отдельно для полной информации
          console.error(`[WebRTC] ❌ Raw error object:`, error)
          
          // Если это ошибка о неправильном состоянии, не пересоздавать соединение
          // Это может быть нормальной ситуацией (например, дублирующий сигнал)
          if (errorMessage.includes('have-remote-offer') || errorMessage.includes('wrong state') || errorMessage.includes('Called in wrong state')) {
            console.warn(`[WebRTC] ⚠️ Answer handling failed due to state mismatch, this is likely a duplicate signal or race condition`)
            return
          }
        }
        
        // После обработки answer, negotiation завершена - убедиться, что мы не создадим новый offer
        const signalingStateAfterAnswer = peerManager.getPeerConnection().signalingState
        const hasLocalAfterAnswer = !!peerManager.getPeerConnection().localDescription
        const hasRemoteAfterAnswer = !!peerManager.getPeerConnection().remoteDescription
        
        const connectionStateAfter = peerManager.getConnectionState()
        const iceStateAfter = peerManager.getIceConnectionState()
        console.log(`[WebRTC] ✅ Answer processed for ${signal.from}`, {
          signalingState: signalingStateAfterAnswer,
          negotiationComplete: hasLocalAfterAnswer && hasRemoteAfterAnswer,
          localDescriptionType: peerManager.getPeerConnection().localDescription?.type,
          remoteDescriptionType: peerManager.getPeerConnection().remoteDescription?.type,
          connection: connectionStateAfter,
          ice: iceStateAfter,
        })
        
        // Проверить, есть ли уже полученные потоки
        const transceivers = peerManager.getPeerConnection().getTransceivers()
        const receivers = peerManager.getPeerConnection().getReceivers()
        console.log(`[WebRTC] 📊 Transceivers and receivers after answer from ${signal.from}:`, {
          transceivers: transceivers.map(t => ({
            mid: t.mid,
            direction: t.direction,
            currentDirection: t.currentDirection,
            senderTrack: t.sender.track ? {
              id: t.sender.track.id,
              kind: t.sender.track.kind,
              enabled: t.sender.track.enabled,
            } : null,
            receiverTrack: t.receiver.track ? {
              id: t.receiver.track.id,
              kind: t.receiver.track.kind,
              enabled: t.receiver.track.enabled,
              readyState: t.receiver.track.readyState,
            } : null,
          })),
          receivers: receivers.map(r => ({
            track: r.track ? {
              id: r.track.id,
              kind: r.track.kind,
              enabled: r.track.enabled,
              readyState: r.track.readyState,
            } : null,
          })),
        })
        
        // Проверить, есть ли уже потоки в remoteStreams
        const existingStream = remoteStreams.get(signal.from)
        if (existingStream) {
          console.log(`[WebRTC] ✅ Remote stream already exists for ${signal.from}:`, {
            streamId: existingStream.id,
            videoTracks: existingStream.getVideoTracks().length,
            audioTracks: existingStream.getAudioTracks().length,
          })
        } else {
          console.log(`[WebRTC] ⚠️ No remote stream yet for ${signal.from}, waiting for ontrack event...`)
        }
      } else if (signal.type === "ice-candidate") {
        console.log(`[WebRTC] 🧊 Adding ICE candidate from ${signal.from}`, {
          hasData: !!signal.data,
          candidate: signal.data?.candidate?.substring(0, 50) || "null",
        })
        try {
          await peerManager.addIceCandidate(signal.data as RTCIceCandidateInit)
          console.log(`[WebRTC] ✅ ICE candidate added successfully from ${signal.from}`)
        } catch (err) {
          console.error(`[WebRTC] ❌ Error adding ICE candidate from ${signal.from}:`, err)
        }
      }
    },
    [currentPlayerId, localStream],
  )

  // Update ref when handleWebRTCSignal changes
  useEffect(() => {
    handleWebRTCSignalRef.current = handleWebRTCSignal
  }, [handleWebRTCSignal])

      // Создать соединения с новыми игроками
  useEffect(() => {
    console.log("[WebRTC] 🔄 Connection creation effect triggered:", {
      currentPlayerId,
      hasSignaling: !!signalingRef.current,
      hasLocalStream: !!localStream,
      otherPlayerIds,
      otherPlayersCount: otherPlayers.length,
      otherPlayers: otherPlayers.map(p => ({ id: p.id, playerId: p.playerId })),
    })
    
    // Allow connection creation even without local stream (to receive remote streams)
    if (!currentPlayerId) {
      console.warn("[WebRTC] ⚠️ Skipping connection creation: No current player ID")
      return
    }
    
    if (!signalingRef.current || !signalingConnected) {
      console.warn("[WebRTC] ⚠️ Skipping connection creation: Signaling not connected yet", {
        hasSignalingRef: !!signalingRef.current,
        signalingConnected,
      })
      return
    }
    
    // Warn if local stream is not available, but continue anyway
    if (!localStream) {
      console.log("[WebRTC] ℹ️ Creating connections without local stream (will only receive remote streams)")
    }

    // Create stable set of player IDs to avoid infinite loops
    const currentPlayerIds = new Set(otherPlayers.map((p) => p.playerId || p.id).filter(Boolean))
    const existingConnections = new Set(peerConnectionsRef.current.keys())
    
    // Check if player IDs actually changed OR if we have existing connections that need to be recreated
    // (this handles page reload case where connections are lost but player IDs are the same)
    const playerIdsChanged = otherPlayerIds !== lastOtherPlayersIdsRef.current
    const hasExistingConnections = existingConnections.size > 0
    const needsNewConnections = Array.from(currentPlayerIds).some(id => 
      id !== currentPlayerId && !existingConnections.has(id)
    )
    
    // При первой загрузке или перезагрузке страницы нужно пересоздать все соединения
    const isFirstMount = isInitialMountRef.current
    
    // НЕ сбрасывать isInitialMountRef здесь - это нужно сделать ПОСЛЕ создания соединений
    // чтобы избежать повторных срабатываний эффекта
    
    // Если ID игроков не изменились, но есть существующие соединения, проверяем их состояние
    // Если соединения закрыты или не работают, нужно пересоздать
    let needsReconnection = false
    if (!playerIdsChanged && hasExistingConnections && !isFirstMount) {
      // Проверить состояние существующих соединений
      for (const [playerId, peerManager] of peerConnectionsRef.current.entries()) {
        const connectionState = peerManager.getConnectionState()
        const iceState = peerManager.getIceConnectionState()
        // Если соединение закрыто или не установлено, нужно пересоздать
        if (connectionState === 'closed' || connectionState === 'failed' || 
            iceState === 'closed' || iceState === 'failed' || iceState === 'disconnected') {
          console.log(`[WebRTC] 🔄 Connection to ${playerId} is in bad state (${connectionState}/${iceState}), will recreate`)
          needsReconnection = true
          // Закрыть старое соединение
          peerManager.close()
          peerConnectionsRef.current.delete(playerId)
          setRemoteStreams((prev) => {
            const next = new Map(prev)
            next.delete(playerId)
            return next
          })
        }
      }
    }
    
    // КРИТИЧНО: После перезагрузки страницы (isFirstMount) нужно ВСЕГДА создавать соединения,
    // даже если otherPlayerIds не изменились, потому что старые соединения были закрыты
    if (isFirstMount) {
      console.log("[WebRTC] 🔄 First mount detected, will create all connections regardless of player IDs change")
      // Принудительно установить needsNewConnections для всех игроков
      for (const playerId of currentPlayerIds) {
        if (playerId !== currentPlayerId && !existingConnections.has(playerId)) {
          // Это будет обработано ниже
        }
      }
    } else if (!playerIdsChanged && !needsNewConnections && !needsReconnection) {
      // Player IDs haven't changed and no reconnection needed, skip
      console.debug("[WebRTC] Player IDs haven't changed and connections are healthy, skipping connection creation")
      return
    }
    
    if (playerIdsChanged || isFirstMount) {
      console.log("[WebRTC] Player IDs changed or first mount, creating connections. Previous:", lastOtherPlayersIdsRef.current, "New:", otherPlayerIds)
      lastOtherPlayersIdsRef.current = otherPlayerIds
    } else if (needsReconnection) {
      console.log("[WebRTC] 🔄 Reconnection needed due to failed/closed connections")
    }
    
    // После перезагрузки (isFirstMount) нужно создать соединения для всех игроков
    if (isFirstMount) {
      console.log("[WebRTC] 🔄 First mount: creating connections for all players. Current IDs:", Array.from(currentPlayerIds), "Existing:", Array.from(existingConnections))
      // Продолжить создание соединений ниже
    } else if (!needsNewConnections && !needsReconnection) {
      // No new connections needed, skip
      console.log("[WebRTC] No new connections needed. Current IDs:", Array.from(currentPlayerIds), "Existing:", Array.from(existingConnections))
      return
    }
    
    console.log("[WebRTC] ✅ Creating connections:", { 
      currentPlayerIds: Array.from(currentPlayerIds), 
      existingConnections: Array.from(existingConnections),
      otherPlayersCount: otherPlayers.length,
      needsNewConnections: true
    })

    // Удалить соединения с игроками, которые больше не в комнате
    for (const [playerId, peerManager] of peerConnectionsRef.current.entries()) {
      if (!currentPlayerIds.has(playerId) && playerId !== currentPlayerId) {
        peerManager.close()
        peerConnectionsRef.current.delete(playerId)
        setRemoteStreams((prev) => {
          const next = new Map(prev)
          next.delete(playerId)
          return next
        })
      }
    }

    // Создать соединения с новыми игроками
    // После перезагрузки (isFirstMount) нужно создать соединения для ВСЕХ игроков,
    // даже если они уже были в existingConnections (потому что соединения были закрыты)
    for (const playerId of currentPlayerIds) {
      if (playerId === currentPlayerId) continue
      
      // После перезагрузки игнорируем existingConnections, так как они были закрыты
      if (!isFirstMount && existingConnections.has(playerId)) {
        console.log(`[WebRTC] ⏭️ Skipping ${playerId} - connection already exists (not first mount)`)
        continue
      }
      
      if (isFirstMount) {
        console.log(`[WebRTC] 🔄 First mount: creating new connection for ${playerId}`)
        // Сбросить isInitialMountRef после начала создания первого соединения
        // Это предотвратит повторное срабатывание логики перезагрузки
        isInitialMountRef.current = false
      }

      // Инициатор - игрок с локальным потоком (камера включена)
      // Если у обоих есть потоки или у обоих нет, то игрок с меньшим ID
      // Это гарантирует, что игрок с камерой всегда инициирует соединение
      const hasLocalStream = !!localStream
      // Предполагаем, что если у нас есть локальный поток, мы должны быть инициатором
      // Если у нас нет потока, мы ждем offer от другого игрока
      const isInitiator = hasLocalStream || (!hasLocalStream && currentPlayerId < playerId)
      isInitiatorRef.current.set(playerId, isInitiator)
      
      console.log(`[WebRTC] 🔀 Determining initiator for ${playerId}:`, {
        currentPlayerId,
        otherPlayerId: playerId,
        hasLocalStream,
        isInitiator,
        reason: hasLocalStream ? "we have local stream" : "lexicographic order",
      })

      if (isInitiator) {
        console.debug(`[WebRTC] Creating offer for player ${playerId} (isInitiator: true)`)
        // Создать offer и отправить
        const peerManager = new PeerConnectionManager({
          playerId,
          onStream: (stream) => {
            console.log(`[WebRTC] ✅ Received remote stream from ${playerId} (via offer):`, {
              streamId: stream.id,
              videoTracks: stream.getVideoTracks().length,
              audioTracks: stream.getAudioTracks().length,
              videoEnabled: stream.getVideoTracks().some(t => t.enabled),
              audioEnabled: stream.getAudioTracks().some(t => t.enabled),
              trackIds: stream.getTracks().map(t => ({ id: t.id, kind: t.kind, enabled: t.enabled, readyState: t.readyState })),
            })
            setRemoteStreams((prev) => {
              const next = new Map(prev)
              next.set(playerId, stream)
              console.log(`[WebRTC] ✅ Updated remoteStreams map (via offer), now has ${next.size} streams. Keys:`, Array.from(next.keys()))
              return next
            })
          },
          onIceCandidate: async (candidate) => {
            if (signalingRef.current) {
              try {
                // Убедиться, что канал подключен перед отправкой
                await signalingRef.current.connect((signal: WebRTCSignal) => {
                  if (handleWebRTCSignalRef.current) {
                    handleWebRTCSignalRef.current(signal)
                  }
                })
                await signalingRef.current.sendIceCandidate(playerId, candidate.toJSON())
              } catch (err) {
                console.error(`[WebRTC] Error sending ICE candidate for ${playerId}:`, err)
              }
            }
          },
          onConnectionStateChange: (state) => {
            setConnectionStates((prev) => {
              const next = new Map(prev)
              next.set(playerId, state)
              return next
            })
          },
        })

        peerConnectionsRef.current.set(playerId, peerManager)

        // ВАЖНО: Добавить локальный поток ПЕРЕД созданием offer
        // Это необходимо для правильного SDP negotiation
        if (localStream) {
          peerManager.addLocalStream(localStream)
          console.debug(`[WebRTC] Added local stream to peer connection for ${playerId} before creating offer`)
        } else {
          console.debug(`[WebRTC] No local stream available for ${playerId}, will only receive remote stream`)
        }

        // Проверить signaling state и negotiation status перед созданием offer
        const peerConnection = peerManager.getPeerConnection()
        const signalingState = peerConnection.signalingState
        const hasLocalDescription = !!peerConnection.localDescription
        const hasRemoteDescription = !!peerConnection.remoteDescription
        
        console.log(`[WebRTC] 🔍 Checking if we can create offer for ${playerId}`, {
          signalingState,
          hasLocalDescription,
          hasRemoteDescription,
          localDescriptionType: peerConnection.localDescription?.type || 'none',
          remoteDescriptionType: peerConnection.remoteDescription?.type || 'none',
          connectionState: peerConnection.connectionState,
          iceState: peerConnection.iceConnectionState,
          hasLocalStream: !!localStream,
          isInitiator: isInitiatorRef.current.get(playerId),
        })
        
        // Нельзя создавать offer если:
        // 1. Signaling state не 'stable'
        // 2. Уже есть local description типа 'offer' (offer уже создан, ждем answer)
        // 3. Negotiation уже завершена (есть и local и remote description)
        if (signalingState !== 'stable') {
          console.warn(`[WebRTC] ⚠️ Cannot create offer for ${playerId}: signaling state is '${signalingState}', skipping`, {
            localDescription: peerConnection.localDescription ? { type: peerConnection.localDescription.type } : null,
            remoteDescription: peerConnection.remoteDescription ? { type: peerConnection.remoteDescription.type } : null,
          })
          continue // Использовать continue вместо return, чтобы не прерывать цикл
        }
        
        if (hasLocalDescription && peerConnection.localDescription?.type === 'offer') {
          console.warn(`[WebRTC] ⚠️ Cannot create offer for ${playerId}: local description already set to 'offer', waiting for answer`, {
            localDescriptionSdpLength: peerConnection.localDescription?.sdp?.length,
            remoteDescription: peerConnection.remoteDescription ? { type: peerConnection.remoteDescription.type } : null,
          })
          continue // Использовать continue вместо return
        }
        
        if (hasLocalDescription && hasRemoteDescription) {
          console.warn(`[WebRTC] ⚠️ Cannot create offer for ${playerId}: negotiation already completed (local: ${peerConnection.localDescription?.type}, remote: ${peerConnection.remoteDescription?.type}), skipping`, {
            localDescriptionSdpLength: peerConnection.localDescription?.sdp?.length,
            remoteDescriptionSdpLength: peerConnection.remoteDescription?.sdp?.length,
          })
          continue // Использовать continue вместо return
        }
        
        console.log(`[WebRTC] ✅ All checks passed, creating offer for ${playerId}`)
        
        // Создать и отправить offer (с проверкой подключения канала)
        // Offer создается с offerToReceiveAudio/Video, так что даже без локального потока мы можем получать удаленные потоки
        
        // Финальная проверка перед вызовом createOffer
        const finalPeerConnection = peerManager.getPeerConnection()
        const finalSignalingState = finalPeerConnection.signalingState
        const finalHasLocalDesc = !!finalPeerConnection.localDescription
        const finalHasRemoteDesc = !!finalPeerConnection.remoteDescription
        
        if (finalSignalingState !== 'stable') {
          console.warn(`[WebRTC] ⚠️ Skipping offer creation for ${playerId}: signaling state changed to '${finalSignalingState}'`)
          continue
        }
        
        if (finalHasLocalDesc && finalPeerConnection.localDescription?.type === 'offer') {
          console.warn(`[WebRTC] ⚠️ Skipping offer creation for ${playerId}: offer already created`)
          continue
        }
        
        if (finalHasLocalDesc && finalHasRemoteDesc) {
          console.warn(`[WebRTC] ⚠️ Skipping offer creation for ${playerId}: negotiation already completed`)
          continue
        }
        
        // Проверить, не создается ли уже offer для этого игрока
        if (isCreatingOfferRef.current.get(playerId)) {
          console.warn(`[WebRTC] ⚠️ Skipping offer creation for ${playerId}: offer creation already in progress`)
          continue
        }
        
        // Установить флаг создания offer
        isCreatingOfferRef.current.set(playerId, true)
        
        peerManager
          .createOffer()
          .then(async (offer) => {
            // Сбросить флаг после успешного создания
            isCreatingOfferRef.current.set(playerId, false)
            console.log(`[WebRTC] ✅ Created offer for ${playerId}, sending via signaling`, {
              offerType: offer.type,
              hasSdp: !!offer.sdp,
              sdpLength: offer.sdp?.length,
              hasSignaling: !!signalingRef.current,
            })
            if (signalingRef.current) {
              try {
                // Убедиться, что канал подключен перед отправкой
                // Если канал не подключен, connect() подключит его или вернет существующий
                await signalingRef.current.connect((signal: WebRTCSignal) => {
                  if (handleWebRTCSignalRef.current) {
                    handleWebRTCSignalRef.current(signal)
                  }
                })
                console.log(`[WebRTC] 📤 Sending offer to ${playerId} via Socket.io`)
                await signalingRef.current.sendOffer(playerId, offer)
                console.log(`[WebRTC] ✅ Offer sent successfully to ${playerId}`)
              } catch (err) {
                console.error(`[WebRTC] ❌ Error sending offer for ${playerId}:`, err)
              }
            } else {
              console.error(`[WebRTC] ❌ No signaling ref available to send offer to ${playerId}`)
            }
          })
          .catch((err) => {
            // Сбросить флаг при ошибке
            isCreatingOfferRef.current.set(playerId, false)
            
            const errorMessage = err instanceof Error ? err.message : String(err)
            const errorName = err instanceof Error ? err.name : 'Unknown'
            
            console.error(`[WebRTC] ❌ Error creating offer for ${playerId}:`, {
              error: errorMessage,
              errorName,
              playerId,
              signalingState: peerManager.getPeerConnection().signalingState,
              localDescription: peerManager.getPeerConnection().localDescription ? { 
                type: peerManager.getPeerConnection().localDescription.type,
                sdpLength: peerManager.getPeerConnection().localDescription.sdp?.length,
              } : null,
              remoteDescription: peerManager.getPeerConnection().remoteDescription ? { 
                type: peerManager.getPeerConnection().remoteDescription.type,
                sdpLength: peerManager.getPeerConnection().remoteDescription.sdp?.length,
              } : null,
            })
            
            // Если это ошибка о m-lines, закрыть соединение и удалить его
            if (errorMessage.includes('m-lines') || errorMessage.includes('order')) {
              console.warn(`[WebRTC] ⚠️ Closing connection to ${playerId} due to m-lines error, will be recreated`)
              peerManager.close()
              peerConnectionsRef.current.delete(playerId)
              setRemoteStreams((prev) => {
                const next = new Map(prev)
                next.delete(playerId)
                return next
              })
            }
          })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localStream, currentPlayerId, otherPlayerIds, signalingConnected])
  
  // Дополнительный эффект: если локальный поток появился после создания соединений,
  // нужно пересоздать offer для всех существующих соединений, где мы должны быть инициаторами
  // Это особенно важно после перезагрузки страницы
  useEffect(() => {
    if (!localStream || !signalingConnected || !currentPlayerId) {
      return
    }
    
    console.log(`[WebRTC] 🔄 Local stream appeared, checking if we need to create offers for existing connections`, {
      connectionsCount: peerConnectionsRef.current.size,
      connectionIds: Array.from(peerConnectionsRef.current.keys()),
    })
    
    // Проверить все существующие соединения
    for (const [playerId, peerManager] of peerConnectionsRef.current.entries()) {
      if (playerId === currentPlayerId) continue
      
      const connectionState = peerManager.getConnectionState()
      const iceState = peerManager.getIceConnectionState()
      const hasTracks = peerManager.getPeerConnection().getSenders().some(s => s.track)
      const currentInitiator = isInitiatorRef.current.get(playerId)
      
      // Если у нас есть локальный поток, мы должны быть инициатором
      // Если мы еще не инициаторы или не добавили локальный поток, нужно пересоздать offer
      // Также пересоздаем offer, если соединение не установлено (после перезагрузки)
      const shouldBeInitiator = true // Если у нас есть локальный поток, мы всегда инициаторы
      
      // Проверить signaling state и negotiation status ПЕРЕД проверкой needsReoffer
      const peerConnection = peerManager.getPeerConnection()
      const signalingState = peerConnection.signalingState
      const hasLocalDesc = !!peerConnection.localDescription
      const hasRemoteDesc = !!peerConnection.remoteDescription
      const localDescType = peerConnection.localDescription?.type
      const remoteDescType = peerConnection.remoteDescription?.type
      
      // КРИТИЧНО: Если negotiation уже завершена (есть и local и remote description),
      // НЕ пытаться создавать новый offer - это вызовет ошибку о порядке m-lines
      if (hasLocalDesc && hasRemoteDesc) {
        console.log(`[WebRTC] ⚠️ Skipping offer creation for ${playerId}: negotiation already completed`, {
          localDescriptionType: localDescType,
          remoteDescriptionType: remoteDescType,
          signalingState,
          connectionState,
          iceState,
        })
        continue // Пропустить это соединение
      }
      
      // Если уже есть local description типа 'offer', negotiation в процессе, не создавать новый offer
      if (hasLocalDesc && localDescType === 'offer') {
        console.log(`[WebRTC] ⚠️ Skipping offer creation for ${playerId}: offer already sent, waiting for answer`, {
          localDescriptionType: localDescType,
          remoteDescriptionType: remoteDescType,
          signalingState,
        })
        continue // Пропустить это соединение
      }
      
      // Проверить, нужно ли пересоздать offer:
      // 1. Если мы не инициаторы
      // 2. Если нет tracks в senders
      // 3. Если соединение в начальном состоянии (new, connecting)
      // 4. Если ICE в начальном состоянии (new, checking)
      // 5. Если соединение не установлено (disconnected, failed, closed)
      // НО только если negotiation еще не началась (нет local description)
      const needsReoffer = (!hasLocalDesc && !hasRemoteDesc) && (
        !currentInitiator || !hasTracks || 
        connectionState === 'new' || connectionState === 'connecting' ||
        iceState === 'new' || iceState === 'checking' ||
        connectionState === 'disconnected' || connectionState === 'failed' || connectionState === 'closed' ||
        iceState === 'disconnected' || iceState === 'failed' || iceState === 'closed'
      )
      
      if (shouldBeInitiator && needsReoffer) {
        // Проверить signaling state и negotiation status еще раз перед пересозданием
        const peerConnectionForRecreate = peerManager.getPeerConnection()
        const signalingStateForRecreate = peerConnectionForRecreate.signalingState
        const hasLocalDescInRecreate = !!peerConnectionForRecreate.localDescription
        const hasRemoteDescInRecreate = !!peerConnectionForRecreate.remoteDescription
        
        // Если negotiation уже завершена, не пересоздавать соединение
        if (hasLocalDescInRecreate && hasRemoteDescInRecreate) {
          console.log(`[WebRTC] ⚠️ Cannot recreate connection for ${playerId}: negotiation already completed`, {
            localDescriptionType: peerConnectionForRecreate.localDescription?.type,
            remoteDescriptionType: peerConnectionForRecreate.remoteDescription?.type,
            signalingState: signalingStateForRecreate,
          })
          continue // Пропустить это соединение
        }
        
        // Если соединение уже в процессе negotiation, нужно закрыть его и создать новое
        if (signalingStateForRecreate !== 'stable' && signalingStateForRecreate !== 'have-local-pranswer' && signalingStateForRecreate !== 'have-remote-pranswer') {
          console.log(`[WebRTC] 🔄 Connection to ${playerId} is in '${signalingStateForRecreate}' state, closing and recreating...`)
          
          // Закрыть старое соединение
          peerManager.close()
          peerConnectionsRef.current.delete(playerId)
          setRemoteStreams((prev) => {
            const next = new Map(prev)
            next.delete(playerId)
            return next
          })
          
          // Создать новое соединение
          const newPeerManager = new PeerConnectionManager({
            playerId,
            onStream: (stream) => {
              console.log(`[WebRTC] ✅ Received remote stream from ${playerId} (recreated connection):`, {
                streamId: stream.id,
                videoTracks: stream.getVideoTracks().length,
                audioTracks: stream.getAudioTracks().length,
              })
              setRemoteStreams((prev) => {
                const next = new Map(prev)
                next.set(playerId, stream)
                return next
              })
            },
            onIceCandidate: async (candidate) => {
              if (signalingRef.current) {
                try {
                  await signalingRef.current.connect((signal: WebRTCSignal) => {
                    if (handleWebRTCSignalRef.current) {
                      handleWebRTCSignalRef.current(signal)
                    }
                  })
                  await signalingRef.current.sendIceCandidate(playerId, candidate.toJSON())
                } catch (err) {
                  console.error(`[WebRTC] Error sending ICE candidate for ${playerId}:`, err)
                }
              }
            },
            onConnectionStateChange: (state) => {
              setConnectionStates((prev) => {
                const next = new Map(prev)
                next.set(playerId, state)
                return next
              })
            },
          })
          
          peerConnectionsRef.current.set(playerId, newPeerManager)
          isInitiatorRef.current.set(playerId, true)
          
          // Добавить локальный поток и создать offer
          newPeerManager.addLocalStream(localStream)
          
          // Проверить, не создается ли уже offer для этого игрока
          if (isCreatingOfferRef.current.get(playerId)) {
            console.warn(`[WebRTC] ⚠️ Skipping offer creation for ${playerId} (recreated connection): offer creation already in progress`)
            return
          }
          
          // Установить флаг создания offer
          isCreatingOfferRef.current.set(playerId, true)
          
          newPeerManager
            .createOffer()
            .then(async (offer) => {
              // Сбросить флаг после успешного создания
              isCreatingOfferRef.current.set(playerId, false)
              console.log(`[WebRTC] ✅ Created offer for ${playerId} (recreated connection)`)
              if (signalingRef.current) {
                try {
                  await signalingRef.current.connect((signal: WebRTCSignal) => {
                    if (handleWebRTCSignalRef.current) {
                      handleWebRTCSignalRef.current(signal)
                    }
                  })
                  await signalingRef.current.sendOffer(playerId, offer)
                  console.log(`[WebRTC] ✅ Offer sent to ${playerId} (recreated connection)`)
                } catch (err) {
                  console.error(`[WebRTC] ❌ Error sending offer to ${playerId}:`, err)
                }
              }
            })
            .catch((err) => {
              // Сбросить флаг при ошибке
              isCreatingOfferRef.current.set(playerId, false)
              console.error(`[WebRTC] ❌ Error creating offer for ${playerId}:`, err)
            })
        } else {
          // Соединение в стабильном состоянии, можно просто добавить поток и создать offer
          console.log(`[WebRTC] 📤 Local stream appeared, creating offer for ${playerId} (we should be initiator)`, {
            currentInitiator,
            hasTracks,
            shouldBeInitiator,
            connectionState,
            iceState,
            needsReoffer,
            signalingState,
          })
          
          // Обновить статус инициатора
          isInitiatorRef.current.set(playerId, true)
          
          // Добавить локальный поток
          peerManager.addLocalStream(localStream)
          
          // Проверить signaling state и negotiation status перед созданием offer
          const peerConnectionBeforeOffer = peerManager.getPeerConnection()
          const signalingStateBeforeOffer = peerConnectionBeforeOffer.signalingState
          const hasLocalDesc = !!peerConnectionBeforeOffer.localDescription
          const hasRemoteDesc = !!peerConnectionBeforeOffer.remoteDescription
          
          console.log(`[WebRTC] 🔍 Checking if we can create offer for ${playerId} (after local stream appeared)`, {
            signalingState: signalingStateBeforeOffer,
            hasLocalDescription: hasLocalDesc,
            hasRemoteDescription: hasRemoteDesc,
            localDescriptionType: peerConnectionBeforeOffer.localDescription?.type || 'none',
            remoteDescriptionType: peerConnectionBeforeOffer.remoteDescription?.type || 'none',
            connectionState: peerConnectionBeforeOffer.connectionState,
            iceState: peerConnectionBeforeOffer.iceConnectionState,
            currentInitiator,
            hasTracks,
            shouldBeInitiator,
            needsReoffer,
          })
          
          if (signalingStateBeforeOffer !== 'stable') {
            console.warn(`[WebRTC] ⚠️ Cannot create offer for ${playerId} (after local stream): signaling state is '${signalingStateBeforeOffer}', skipping`, {
              localDescription: peerConnectionBeforeOffer.localDescription ? { type: peerConnectionBeforeOffer.localDescription.type } : null,
              remoteDescription: peerConnectionBeforeOffer.remoteDescription ? { type: peerConnectionBeforeOffer.remoteDescription.type } : null,
            })
            return
          }
          
          if (hasLocalDesc && peerConnectionBeforeOffer.localDescription?.type === 'offer') {
            console.warn(`[WebRTC] ⚠️ Cannot create offer for ${playerId} (after local stream): local description already set to 'offer', waiting for answer`, {
              localDescriptionSdpLength: peerConnectionBeforeOffer.localDescription?.sdp?.length,
              remoteDescription: peerConnectionBeforeOffer.remoteDescription ? { type: peerConnectionBeforeOffer.remoteDescription.type } : null,
            })
            return
          }
          
          if (hasLocalDesc && hasRemoteDesc) {
            console.warn(`[WebRTC] ⚠️ Cannot create offer for ${playerId} (after local stream): negotiation already completed (local: ${peerConnectionBeforeOffer.localDescription?.type}, remote: ${peerConnectionBeforeOffer.remoteDescription?.type}), skipping`, {
              localDescriptionSdpLength: peerConnectionBeforeOffer.localDescription?.sdp?.length,
              remoteDescriptionSdpLength: peerConnectionBeforeOffer.remoteDescription?.sdp?.length,
            })
            return
          }
          
          console.log(`[WebRTC] ✅ All checks passed, creating offer for ${playerId} (after local stream appeared)`)
          
          // Проверить, не создается ли уже offer для этого игрока
          if (isCreatingOfferRef.current.get(playerId)) {
            console.warn(`[WebRTC] ⚠️ Skipping offer creation for ${playerId} (after local stream): offer creation already in progress`)
            return
          }
          
          // Установить флаг создания offer
          isCreatingOfferRef.current.set(playerId, true)
          
          // Создать и отправить offer
          peerManager
            .createOffer()
            .then(async (offer) => {
              // Сбросить флаг после успешного создания
              isCreatingOfferRef.current.set(playerId, false)
              console.log(`[WebRTC] ✅ Created offer for ${playerId} (after local stream appeared)`)
              if (signalingRef.current) {
                try {
                  await signalingRef.current.connect((signal: WebRTCSignal) => {
                    if (handleWebRTCSignalRef.current) {
                      handleWebRTCSignalRef.current(signal)
                    }
                  })
                  await signalingRef.current.sendOffer(playerId, offer)
                  console.log(`[WebRTC] ✅ Offer sent to ${playerId} (after local stream appeared)`)
                } catch (err) {
                  console.error(`[WebRTC] ❌ Error sending offer to ${playerId}:`, err)
                }
              }
            })
            .catch((err) => {
              // Сбросить флаг при ошибке
              isCreatingOfferRef.current.set(playerId, false)
              console.error(`[WebRTC] ❌ Error creating offer for ${playerId}:`, err)
              // Если ошибка связана с signaling state, пересоздать соединение
              if (err instanceof Error && err.message.includes('signaling state')) {
                console.log(`[WebRTC] 🔄 Retrying by recreating connection for ${playerId}`)
                // Закрыть и пересоздать соединение (код выше)
              }
            })
        }
      } else {
        console.log(`[WebRTC] ℹ️ No need to recreate offer for ${playerId}:`, {
          currentInitiator,
          hasTracks,
          shouldBeInitiator,
          connectionState,
          iceState,
          needsReoffer,
        })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localStream, signalingConnected, currentPlayerId])

  // Обновить локальный поток во всех peer connections
  useEffect(() => {
    if (!localStream) {
      console.debug("[WebRTC] No local stream, skipping peer connection updates")
      return
    }

    console.log(`[WebRTC] Updating local stream in ${peerConnectionsRef.current.size} peer connections`)
    for (const [playerId, peerManager] of peerConnectionsRef.current.entries()) {
      const hasTracks = peerManager.getPeerConnection().getSenders().some(s => s.track)
      if (!hasTracks) {
        console.log(`[WebRTC] Adding local stream to existing peer connection for ${playerId}`)
        peerManager.addLocalStream(localStream)
        // Если соединение уже установлено, нужно пересоздать offer/answer
        // Но это сложно, поэтому просто добавим поток - он будет использован при следующем переподключении
      } else {
        console.debug(`[WebRTC] Peer connection for ${playerId} already has tracks`)
      }
    }
    
    // Синхронизировать состояние включенности треков
    const videoTracks = localStream.getVideoTracks()
    const audioTracks = localStream.getAudioTracks()
    
    if (videoTracks.length > 0) {
      setVideoEnabled(videoTracks[0].enabled)
    }
    if (audioTracks.length > 0) {
      setAudioEnabled(audioTracks[0].enabled)
    }
  }, [localStream])

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks()
      audioTracks.forEach((track) => {
        track.enabled = !track.enabled
      })
      setAudioEnabled((prev) => !prev)
    }
  }, [localStream])

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks()
      videoTracks.forEach((track) => {
        track.enabled = !track.enabled
      })
      setVideoEnabled((prev) => !prev)
    }
  }, [localStream])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      localStream?.getTracks().forEach((track) => track.stop())
      for (const peerManager of peerConnectionsRef.current.values()) {
        peerManager.close()
      }
      peerConnectionsRef.current.clear()
      signalingRef.current?.disconnect()
    }
  }, [localStream])

  return {
    localStream,
    remoteStreams,
    audioEnabled,
    videoEnabled,
    error,
    connectionStates,
    initializeMedia,
    toggleAudio,
    toggleVideo,
  }
}
