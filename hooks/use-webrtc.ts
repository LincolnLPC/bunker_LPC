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
  const lastOtherPlayersIdsRef = useRef<string>("")
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
    try {
      // Check if browser supports getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const errorMsg = "Ваш браузер не поддерживает доступ к камере/микрофону"
        setError(errorMsg)
        console.error("[WebRTC] Browser doesn't support getUserMedia")
        throw new Error(errorMsg)
      }

      // Используем переданные опции или значения по умолчанию
      const requestVideo = options?.video !== false
      const requestAudio = options?.audio !== false

      // Подготовить constraints для видео
      const videoConstraints: MediaTrackConstraints | boolean = requestVideo
        ? {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "user",
            ...(mediaSettings?.cameraDeviceId && { deviceId: { ideal: mediaSettings.cameraDeviceId } }),
          }
        : false

      // Подготовить constraints для аудио
      const audioConstraints: MediaTrackConstraints | boolean = requestAudio
        ? {
            echoCancellation: true,
            noiseSuppression: true,
            ...(mediaSettings?.microphoneDeviceId && { deviceId: { ideal: mediaSettings.microphoneDeviceId } }),
          }
        : false

      console.log("[WebRTC] Requesting camera and microphone access...", {
        video: requestVideo,
        audio: requestAudio,
        cameraDeviceId: mediaSettings?.cameraDeviceId,
        microphoneDeviceId: mediaSettings?.microphoneDeviceId,
      })
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: audioConstraints,
      })
      
      console.log("[WebRTC] Media access granted, stream obtained:", stream.id)
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
      // Check if it's a permission error (NotAllowedError)
      const isPermissionError = 
        (err instanceof DOMException && err.name === "NotAllowedError") ||
        (err instanceof Error && (err.name === "NotAllowedError" || err.message.includes("Permission denied")))
      
      if (isPermissionError) {
        // Permission denied is not a critical error - user can retry manually
        const message = "Доступ к камере/микрофону запрещен. Вы можете включить их позже, нажав кнопку 'Включить камеру'."
        setError(message)
        console.warn("[WebRTC] Permission denied - this is expected if user hasn't granted access. User can retry manually.")
        return null
      }
      
      // For other errors, use the standard error handler
      const { message, recoverable } = handleMediaError(err)
      setError(message)
      
      // Log as warning for recoverable errors, error for non-recoverable
      if (recoverable) {
        console.warn("[WebRTC] Media initialization failed (recoverable):", err, { 
          errorName: err instanceof Error ? err.name : "Unknown",
          errorMessage: err instanceof Error ? err.message : String(err)
        })
      } else {
        console.error("[WebRTC] Media initialization failed (non-recoverable):", err, { 
          errorName: err instanceof Error ? err.name : "Unknown",
          errorMessage: err instanceof Error ? err.message : String(err)
        })
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
        console.log(`[WebRTC] 📊 Connection state before handling answer:`, {
          connection: connectionStateBefore,
          ice: iceStateBefore,
          signaling: signalingStateBefore,
        })
        
        await peerManager.handleAnswer(signal.data as RTCSessionDescriptionInit)
        
        const connectionStateAfter = peerManager.getConnectionState()
        const iceStateAfter = peerManager.getIceConnectionState()
        const signalingStateAfter = peerManager.getPeerConnection().signalingState
        console.log(`[WebRTC] 📊 Connection state after handling answer:`, {
          connection: connectionStateAfter,
          ice: iceStateAfter,
          signaling: signalingStateAfter,
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

    // Check if player IDs actually changed
    if (otherPlayerIds === lastOtherPlayersIdsRef.current) {
      // Player IDs haven't changed, skip
      console.debug("[WebRTC] Player IDs haven't changed, skipping connection creation")
      return
    }
    console.log("[WebRTC] Player IDs changed, creating connections. Previous:", lastOtherPlayersIdsRef.current, "New:", otherPlayerIds)
    lastOtherPlayersIdsRef.current = otherPlayerIds

    // Create stable set of player IDs to avoid infinite loops
    const currentPlayerIds = new Set(otherPlayers.map((p) => p.playerId || p.id).filter(Boolean))
    const existingConnections = new Set(peerConnectionsRef.current.keys())
    
    // Check if we actually need to create new connections
    const needsNewConnections = Array.from(currentPlayerIds).some(id => 
      id !== currentPlayerId && !existingConnections.has(id)
    )
    
    if (!needsNewConnections) {
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
    for (const playerId of currentPlayerIds) {
      if (playerId === currentPlayerId || existingConnections.has(playerId)) continue

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

        // Создать и отправить offer (с проверкой подключения канала)
        // Offer создается с offerToReceiveAudio/Video, так что даже без локального потока мы можем получать удаленные потоки
        peerManager
          .createOffer()
          .then(async (offer) => {
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
            console.error(`[WebRTC] ❌ Error creating offer for ${playerId}:`, err)
          })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localStream, currentPlayerId, otherPlayerIds, signalingConnected])
  
  // Дополнительный эффект: если локальный поток появился после создания соединений,
  // нужно пересоздать offer для всех существующих соединений, где мы должны быть инициаторами
  useEffect(() => {
    if (!localStream || !signalingConnected || !currentPlayerId) {
      return
    }
    
    console.log(`[WebRTC] 🔄 Local stream appeared, checking if we need to create offers for existing connections`)
    
    // Проверить все существующие соединения
    for (const [playerId, peerManager] of peerConnectionsRef.current.entries()) {
      if (playerId === currentPlayerId) continue
      
      const hasTracks = peerManager.getPeerConnection().getSenders().some(s => s.track)
      const currentInitiator = isInitiatorRef.current.get(playerId)
      
      // Если у нас есть локальный поток, мы должны быть инициатором
      // Если мы еще не инициаторы или не добавили локальный поток, нужно пересоздать offer
      const shouldBeInitiator = true // Если у нас есть локальный поток, мы всегда инициаторы
      
      if (shouldBeInitiator && (!currentInitiator || !hasTracks)) {
        console.log(`[WebRTC] 📤 Local stream appeared, creating offer for ${playerId} (we should be initiator)`, {
          currentInitiator,
          hasTracks,
          shouldBeInitiator,
        })
        
        // Обновить статус инициатора
        isInitiatorRef.current.set(playerId, true)
        
        // Добавить локальный поток
        peerManager.addLocalStream(localStream)
        
        // Создать и отправить offer
        peerManager
          .createOffer()
          .then(async (offer) => {
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
            console.error(`[WebRTC] ❌ Error creating offer for ${playerId}:`, err)
          })
      } else {
        console.log(`[WebRTC] ℹ️ No need to recreate offer for ${playerId}:`, {
          currentInitiator,
          hasTracks,
          shouldBeInitiator,
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
