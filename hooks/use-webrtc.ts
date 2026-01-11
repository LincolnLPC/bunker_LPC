"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { WebRTCSignaling } from "@/lib/webrtc/signaling"
import { PeerConnectionManager } from "@/lib/webrtc/peer-connection"
import type { WebRTCSignal } from "@/lib/webrtc/signaling"
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

  const signalingRef = useRef<WebRTCSignaling | null>(null)
  const peerConnectionsRef = useRef<Map<string, PeerConnectionManager>>(new Map())
  const pendingOffersRef = useRef<Map<string, RTCSessionDescriptionInit>>(new Map())
  const isInitiatorRef = useRef<Map<string, boolean>>(new Map())
  const lastOtherPlayersIdsRef = useRef<string>("")
  const handleWebRTCSignalRef = useRef<((signal: WebRTCSignal) => Promise<void>) | null>(null)

  // Create stable reference to player IDs to avoid infinite loops
  const otherPlayerIds = useMemo(() => {
    const ids = otherPlayers.map((p) => p.playerId || p.id).filter(Boolean).sort().join(",")
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
    if (!roomId || !currentPlayerId) return

    const signaling = new WebRTCSignaling(roomId, currentPlayerId)
    signalingRef.current = signaling

    // Подключиться к каналу и обработать сигналы
    let isMounted = true
    let connectPromise: Promise<any> | null = null

    connectPromise = signaling.connect((signal: WebRTCSignal) => {
      if (isMounted) {
        handleWebRTCSignal(signal)
      }
    })
      .then(() => {
        if (isMounted) {
          console.log("[WebRTC] Signaling channel connected successfully")
        }
      })
      .catch((err) => {
        // Игнорировать ошибки закрытия канала при размонтировании
        if (isMounted) {
          const errorMessage = err instanceof Error ? err.message : String(err)
          // Игнорируем ошибки, связанные с закрытием канала во время cleanup
          if (!errorMessage.includes("closed") && 
              !errorMessage.includes("cleanup") && 
              !errorMessage.includes("CLOSED") &&
              !errorMessage.includes("unmount")) {
            console.error("[WebRTC] Error connecting to signaling:", err)
            setError("Failed to connect to signaling server")
          } else {
            // Это нормальное закрытие при cleanup, не показываем ошибку
            console.log("[WebRTC] Signaling channel closed (expected during cleanup):", errorMessage)
          }
        }
      })

    return () => {
      isMounted = false
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
      if (!currentPlayerId) return
      // Игнорируем сигналы от себя и сигналы, не предназначенные нам
      if (signal.from === currentPlayerId || signal.to !== currentPlayerId) {
        return
      }

      console.log(`[WebRTC] Received signal: ${signal.type} from ${signal.from} to ${signal.to}`)

      let peerManager = peerConnectionsRef.current.get(signal.from)

      // Создать peer connection если его нет
      if (!peerManager) {
        peerManager = new PeerConnectionManager({
          playerId: signal.from,
          onStream: (stream) => {
            console.log(`[WebRTC] Received remote stream from ${signal.from} (via signal):`, {
              streamId: stream.id,
              videoTracks: stream.getVideoTracks().length,
              audioTracks: stream.getAudioTracks().length,
              videoEnabled: stream.getVideoTracks().some(t => t.enabled),
              audioEnabled: stream.getAudioTracks().some(t => t.enabled),
            })
            setRemoteStreams((prev) => {
              const next = new Map(prev)
              next.set(signal.from, stream)
              console.log(`[WebRTC] Updated remoteStreams map (via signal), now has ${next.size} streams`)
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
                await signalingRef.current.sendIceCandidate(signal.from, candidate.toJSON())
              } catch (err) {
                console.error(`[WebRTC] Error sending ICE candidate to ${signal.from}:`, err)
              }
            }
          },
          onConnectionStateChange: (state) => {
            setConnectionStates((prev) => {
              const next = new Map(prev)
              next.set(signal.from, state)
              return next
            })
          },
        })

        // Добавить локальный поток если есть (опционально - можно получать потоки без отправки)
        if (localStream) {
          peerManager.addLocalStream(localStream)
          console.debug(`[WebRTC] Added local stream to peer connection for ${signal.from} (via signal)`)
        } else {
          console.debug(`[WebRTC] No local stream available for ${signal.from}, will only receive remote stream`)
        }

        peerConnectionsRef.current.set(signal.from, peerManager)
      }

      // Обработать сигнал
      if (signal.type === "offer") {
        console.log(`[WebRTC] Handling offer from ${signal.from}, localStream available:`, !!localStream)
        // Убедиться, что локальный поток добавлен перед обработкой offer
        if (localStream && !peerManager.getPeerConnection().getSenders().some(s => s.track)) {
          console.log(`[WebRTC] Adding local stream to peer connection for ${signal.from}`)
          peerManager.addLocalStream(localStream)
        }
        const answer = await peerManager.handleOffer(signal.data as RTCSessionDescriptionInit)
        if (signalingRef.current) {
          try {
            // Убедиться, что канал подключен перед отправкой
            await signalingRef.current.connect((signal: WebRTCSignal) => {
              if (handleWebRTCSignalRef.current) {
                handleWebRTCSignalRef.current(signal)
              }
            })
            await signalingRef.current.sendAnswer(signal.from, answer)
            console.log(`[WebRTC] Sent answer to ${signal.from}`)
          } catch (err) {
            console.error(`[WebRTC] Error sending answer to ${signal.from}:`, err)
          }
        }
      } else if (signal.type === "answer") {
        console.log(`[WebRTC] Handling answer from ${signal.from}`)
        await peerManager.handleAnswer(signal.data as RTCSessionDescriptionInit)
      } else if (signal.type === "ice-candidate") {
        console.debug(`[WebRTC] Adding ICE candidate from ${signal.from}`)
        await peerManager.addIceCandidate(signal.data as RTCIceCandidateInit)
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
    // Allow connection creation even without local stream (to receive remote streams)
    if (!currentPlayerId || !signalingRef.current) {
      console.debug("[WebRTC] Skipping connection creation:", { 
        hasLocalStream: !!localStream, 
        currentPlayerId, 
        hasSignaling: !!signalingRef.current,
        reason: !currentPlayerId ? "No current player ID" : 
                "Signaling not connected"
      })
      return
    }
    
    // Warn if local stream is not available, but continue anyway
    if (!localStream) {
      console.debug("[WebRTC] Creating connections without local stream (will only receive remote streams)")
    }

    // Check if player IDs actually changed
    if (otherPlayerIds === lastOtherPlayersIdsRef.current) {
      // Player IDs haven't changed, skip
      return
    }
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
      return
    }
    
    console.debug("[WebRTC] Creating connections:", { 
      currentPlayerIds: Array.from(currentPlayerIds), 
      existingConnections: Array.from(existingConnections),
      otherPlayersCount: otherPlayers.length
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

      // Инициатор - игрок с меньшим ID (чтобы избежать дублирования)
      const isInitiator = currentPlayerId < playerId
      isInitiatorRef.current.set(playerId, isInitiator)

      if (isInitiator) {
        console.debug(`[WebRTC] Creating offer for player ${playerId} (isInitiator: true)`)
        // Создать offer и отправить
        const peerManager = new PeerConnectionManager({
          playerId,
          onStream: (stream) => {
            console.log(`[WebRTC] Received remote stream from ${playerId}:`, {
              streamId: stream.id,
              videoTracks: stream.getVideoTracks().length,
              audioTracks: stream.getAudioTracks().length,
              videoEnabled: stream.getVideoTracks().some(t => t.enabled),
              audioEnabled: stream.getAudioTracks().some(t => t.enabled),
            })
            setRemoteStreams((prev) => {
              const next = new Map(prev)
              next.set(playerId, stream)
              console.log(`[WebRTC] Updated remoteStreams map, now has ${next.size} streams`)
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

        // Add local stream if available (optional - can receive streams without sending)
        if (localStream) {
          peerManager.addLocalStream(localStream)
          console.debug(`[WebRTC] Added local stream to peer connection for ${playerId}`)
        } else {
          console.debug(`[WebRTC] No local stream available for ${playerId}, will only receive remote stream`)
        }
        peerConnectionsRef.current.set(playerId, peerManager)

        // Создать и отправить offer (с проверкой подключения канала)
        peerManager
          .createOffer()
          .then(async (offer) => {
            console.debug(`[WebRTC] Created offer for ${playerId}, sending via signaling`)
            if (signalingRef.current) {
              try {
                // Убедиться, что канал подключен перед отправкой
                // Если канал не подключен, connect() подключит его или вернет существующий
                await signalingRef.current.connect((signal: WebRTCSignal) => {
                  if (handleWebRTCSignalRef.current) {
                    handleWebRTCSignalRef.current(signal)
                  }
                })
                await signalingRef.current.sendOffer(playerId, offer)
              } catch (err) {
                console.error(`[WebRTC] Error sending offer for ${playerId}:`, err)
              }
            }
          })
          .catch((err) => {
            console.error(`[WebRTC] Error creating offer for ${playerId}:`, err)
          })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localStream, currentPlayerId, otherPlayerIds])

  // Обновить локальный поток во всех peer connections
  useEffect(() => {
    if (!localStream) return

    for (const peerManager of peerConnectionsRef.current.values()) {
      peerManager.addLocalStream(localStream)
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
