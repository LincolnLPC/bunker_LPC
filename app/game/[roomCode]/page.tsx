"use client"

import { useEffect, useState, useCallback, useRef, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { GameHeader } from "@/components/game/game-header"
import { PlayerGrid } from "@/components/game/player-grid"
import { CatastropheBanner } from "@/components/game/catastrophe-banner"
import { GameControls } from "@/components/game/game-controls"
import { ConnectionStatus, OnlineStatus } from "@/components/game/connection-status"
import { useGameState } from "@/hooks/use-game-state"
import { useWebRTC } from "@/hooks/use-webrtc"
import { useMediaSettings } from "@/hooks/use-media-settings"
import { createClient } from "@/lib/supabase/client"
import { logger } from "@/lib/logger"
import type { ChatMessage, Player } from "@/types/game"
import { Loader2, X } from "lucide-react"

// Dynamic imports for components that are conditionally rendered or modals
const VotingPanel = dynamic(() => import("@/components/game/voting-panel").then(mod => ({ default: mod.VotingPanel })), {
  ssr: false,
  loading: () => null,
})

const VoteResults = dynamic(() => import("@/components/game/vote-results").then(mod => ({ default: mod.VoteResults })), {
  ssr: false,
  loading: () => null,
})

const ChatPanel = dynamic(() => import("@/components/game/chat-panel").then(mod => ({ default: mod.ChatPanel })), {
  ssr: false,
  loading: () => null,
})

const CharacteristicRevealModal = dynamic(() => import("@/components/game/characteristic-reveal-modal").then(mod => ({ default: mod.CharacteristicRevealModal })), {
  ssr: false,
  loading: () => null,
})

const SettingsModal = dynamic(() => import("@/components/game/settings-modal").then(mod => ({ default: mod.SettingsModal })), {
  ssr: false,
  loading: () => null,
})

const PlayerDetailModal = dynamic(() => import("@/components/game/player-detail-modal").then(mod => ({ default: mod.PlayerDetailModal })), {
  ssr: false,
  loading: () => null,
})

const WaitingRoom = dynamic(() => import("@/components/game/waiting-room").then(mod => ({ default: mod.WaitingRoom })), {
  ssr: false,
})

const MysteryJournal = dynamic(() => import("@/components/game/mystery-journal").then(mod => ({ default: mod.MysteryJournal })), {
  ssr: false,
  loading: () => null,
})

const SacrificialAltar = dynamic(() => import("@/components/game/sacrificial-altar").then(mod => ({ default: mod.SacrificialAltar })), {
  ssr: false,
  loading: () => null,
})

const SpecialActionCards = dynamic(() => import("@/components/game/special-action-cards").then(mod => ({ default: mod.SpecialActionCards })), {
  ssr: false,
  loading: () => null,
})

const BunkerInfoModal = dynamic(() => import("@/components/game/bunker-info").then(mod => ({ default: mod.BunkerInfoModal })), {
  ssr: false,
  loading: () => null,
})

const GameResults = dynamic(() => import("@/components/game/game-results").then(mod => ({ default: mod.GameResults })), {
  ssr: false,
})

const CharacteristicsManager = dynamic(() => import("@/components/game/host-controls/characteristics-manager").then(mod => ({ default: mod.CharacteristicsManager })), {
  ssr: false,
  loading: () => null,
})

const VoteCountsModal = dynamic(() => import("@/components/game/vote-counts-modal").then(mod => ({ default: mod.VoteCountsModal })), {
  ssr: false,
  loading: () => null,
})

const SpecialCardUsedModal = dynamic(() => import("@/components/game/special-card-used-modal").then(mod => ({ default: mod.SpecialCardUsedModal })), {
  ssr: false,
  loading: () => null,
})

const BunkerCharacteristicRevealedModal = dynamic(() => import("@/components/game/bunker-characteristic-revealed-modal").then(mod => ({ default: mod.BunkerCharacteristicRevealedModal })), {
  ssr: false,
  loading: () => null,
})

const WhoamiWordsModal = dynamic(() => import("@/components/game/whoami-words-modal").then(mod => ({ default: mod.WhoamiWordsModal })), {
  ssr: false,
  loading: () => null,
})

const CatastropheIntroScreen = dynamic(() => import("@/components/game/catastrophe-intro-screen").then(mod => ({ default: mod.CatastropheIntroScreen })), {
  ssr: false,
  loading: () => null,
})

const CameraEffectsPanel = dynamic(() => import("@/components/game/camera-effects-panel").then(mod => ({ default: mod.CameraEffectsPanel })), {
  ssr: false,
  loading: () => null,
})

// BunkerInfoModal imported dynamically above

export default function GamePage() {
  const params = useParams()
  const router = useRouter()
  // Extract roomCode immediately to avoid serialization issues with params object
  const roomCode = (params?.roomCode as string) || ""

  const [cameraEffects, setCameraEffects] = useState<Map<string, Array<{ id: string; effect: "tomato" | "egg" | "revolver" }>>>(new Map())
  const onCameraEffectFromRoom = useCallback(
    (payload: { sourcePlayerId: string; targetPlayerId: string; effect: "tomato" | "egg" | "revolver"; effectId: string }) => {
      setCameraEffects((prev) => {
        const next = new Map(prev)
        const list = next.get(payload.targetPlayerId) ?? []
        next.set(payload.targetPlayerId, [...list, { id: payload.effectId, effect: payload.effect }])
        return next
      })
    },
    [],
  )

  const {
    gameState,
    currentPlayerId,
    currentSpectatorId,
    loading,
    isRefreshing,
    error,
    connectionState,
    reconnect,
    toggleCharacteristic,
    startVoting,
    nextRound,
    finishGame,
    eliminatePlayer,
    revealCharacteristic,
    startGame,
    castVote,
    refresh,
    updateCharacteristic,
    randomizeCharacteristic,
    exchangeCharacteristics,
    toggleReady,
    useSpecialCard,
    broadcastCameraEffect,
    whoamiNextWord,
    whoamiVoteConfirm,
  } = useGameState(roomCode, { onCameraEffect: onCameraEffectFromRoom })

  // Загрузить настройки медиа из профиля
  const { settings: mediaSettings, loading: mediaSettingsLoading } = useMediaSettings()

  const {
    localStream,
    remoteStreams,
    audioEnabled,
    videoEnabled,
    error: mediaError,
    isMediaLoading,
    clearMediaError,
    initializeMedia,
    toggleAudio,
    toggleVideo,
    reconnectVideo,
  } = useWebRTC({
    roomId: gameState?.id || "",
    userId: currentPlayerId || currentSpectatorId || "",
    currentPlayerId: currentPlayerId || currentSpectatorId || "",
    otherPlayers: (gameState?.players || []).filter((p) => p.id !== currentPlayerId).map((p) => ({
      id: p.id,
      playerId: p.id,
    })),
    mediaSettings, // Передаем настройки в хук
  })

  // UI state
  const [showChat, setShowChat] = useState(false)
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0)
  const lastReadMessageIdRef = useRef<string | null>(null)
  // Состояние для отключения звука игроков
  const [mutedPlayers, setMutedPlayers] = useState<Set<string>>(new Set())
  const [allPlayersMuted, setAllPlayersMuted] = useState(false)
  
  // Функции для управления звуком
  const togglePlayerMute = useCallback((playerId: string) => {
    setMutedPlayers((prev) => {
      const next = new Set(prev)
      if (next.has(playerId)) {
        next.delete(playerId)
      } else {
        next.add(playerId)
      }
      return next
    })
  }, [])
  
  const toggleAllPlayersMute = useCallback(() => {
    if (allPlayersMuted) {
      // Включить всех
      setMutedPlayers(new Set())
      setAllPlayersMuted(false)
    } else {
      // Отключить всех
      const allPlayerIds = gameState.players
        .filter((p) => p.id !== currentPlayerId)
        .map((p) => p.id)
      setMutedPlayers(new Set(allPlayerIds))
      setAllPlayersMuted(true)
    }
  }, [allPlayersMuted, gameState.players, currentPlayerId])
  const [showRevealModal, setShowRevealModal] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showJournal, setShowJournal] = useState(false)
  const [showAltar, setShowAltar] = useState(false)
  const [showSpecialCards, setShowSpecialCards] = useState(false)
  const [showBunkerInfo, setShowBunkerInfo] = useState(false)
  const [showCharacteristicsManager, setShowCharacteristicsManager] = useState(false)
  const [showVoteCountsModal, setShowVoteCountsModal] = useState(false)
  const [specialCards, setSpecialCards] = useState<any[]>([])
  // Очередь модальных окон — показываются по одному, чтобы не перекрывать друг друга
  type QueuedModal =
    | { type: "special-card"; data: { playerName: string; cardName: string; cardDescription: string; cardType: string } }
    | { type: "bunker-char"; data: { characteristicName: string; characteristicType: "equipment" | "supply" } }
  const [modalQueue, setModalQueue] = useState<QueuedModal[]>([])
  const currentModal = modalQueue[0] ?? null

  const dismissCurrentModal = useCallback(() => {
    setModalQueue((prev) => prev.slice(1))
  }, [])
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)

  // Debug: Log when selectedPlayer changes
  useEffect(() => {
    if (selectedPlayer) {
      logger.log("[GamePage] Selected player changed:", {
        playerId: selectedPlayer.id,
        playerName: selectedPlayer.name,
        isCurrentPlayer: selectedPlayer.id === currentPlayerId,
      })
    } else {
      logger.log("[GamePage] Selected player cleared")
    }
  }, [selectedPlayer, currentPlayerId])

  const [votedPlayerId, setVotedPlayerId] = useState<string | undefined>()
  const [voteResults, setVoteResults] = useState<{ playerId: string; votes: number }[]>([])
  const [eliminatedId, setEliminatedId] = useState<string | undefined>()
  const [showVotingPanel, setShowVotingPanel] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [showDebugInfo, setShowDebugInfo] = useState(false) // Hidden by default
  const [showRefreshIndicator, setShowRefreshIndicator] = useState(false) // Hidden by default
  const [siteProductionMode, setSiteProductionMode] = useState(true) // true = hide debug
  const [topPanelVisible, setTopPanelVisible] = useState(true) // Toggle with N or T key
  const [bottomPanelVisible, setBottomPanelVisible] = useState(true) // Toggle with И or B key
  const [showTeasePanel, setShowTeasePanel] = useState(false)
  const [isPremium, setIsPremium] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch("/api/site-settings")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setSiteProductionMode(data.productionMode !== false)
      })
      .catch(() => {
        if (!cancelled) setSiteProductionMode(true)
      })
    return () => { cancelled = true }
  }, [])

  const showDebug = !siteProductionMode || process.env.NODE_ENV === "development"

  useEffect(() => {
    if (!currentPlayerId) return
    let cancelled = false
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled || !user) {
        if (!cancelled) setIsPremium(false)
        return
      }
      return supabase
        .from("profiles")
        .select("subscription_tier, premium_expires_at")
        .eq("id", user.id)
        .single()
        .then(({ data: profile }) => {
          if (cancelled) return
          const tier = (profile?.subscription_tier || "basic") as string
          const isPremiumTier = tier.toLowerCase() === "premium"
          if (!isPremiumTier) {
            setIsPremium(false)
            return
          }
          const expiresAt = profile?.premium_expires_at
          if (expiresAt && new Date(expiresAt) < new Date()) {
            setIsPremium(false)
            return
          }
          setIsPremium(true)
        })
    }).catch(() => {
      if (!cancelled) setIsPremium(false)
    })
    return () => {
      cancelled = true
    }
  }, [currentPlayerId])
  // Removed catastropheIntroSkipped - now using server state (roundStartedAt) via realtime subscription

  const handleCameraEffectDrop = useCallback(
    async (playerId: string, effect: "tomato" | "egg" | "revolver") => {
      if (!gameState?.id || !currentPlayerId || !broadcastCameraEffect) return
      const effectId = `eff-${Date.now()}-${Math.random().toString(36).slice(2)}`
      try {
        const res = await fetch("/api/game/camera-effect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomId: gameState.id,
            sourcePlayerId: currentPlayerId,
            targetPlayerId: playerId,
            effect,
          }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          logger.warn("[CameraEffect] API error:", data.error || res.statusText)
        }
      } catch (e) {
        logger.warn("[CameraEffect] Failed to send chat message:", e)
      }
      broadcastCameraEffect({
        sourcePlayerId: currentPlayerId,
        targetPlayerId: playerId,
        effect,
        effectId,
      })
      setCameraEffects((prev) => {
        const next = new Map(prev)
        const list = next.get(playerId) ?? []
        next.set(playerId, [...list, { id: effectId, effect }])
        return next
      })
    },
    [gameState?.id, currentPlayerId, broadcastCameraEffect],
  )

  const handleCameraEffectComplete = useCallback((playerId: string, effectId: string) => {
    setCameraEffects((prev) => {
      const next = new Map(prev)
      const list = next.get(playerId) ?? []
      const filtered = list.filter((e) => e.id !== effectId)
      if (filtered.length === 0) next.delete(playerId)
      else next.set(playerId, filtered)
      return next
    })
  }, [])

  // Load vote results when phase changes to results
  useEffect(() => {
    if (gameState.phase === "results" && gameState.id && voteResults.length === 0) {
      fetch(`/api/game/votes/results?roomId=${gameState.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.results) {
            setVoteResults(data.results)
            // Find eliminated player
            const eliminated = gameState.players.find((p) => p.isEliminated && !eliminatedId)
            if (eliminated) {
              setEliminatedId(eliminated.id)
            }
          }
        })
        .catch((err) => console.error("Error loading vote results:", err))
    }
  }, [gameState.phase, gameState.id, gameState.players, voteResults.length, eliminatedId])

  // Check if player has already voted when entering voting phase
  useEffect(() => {
    if (gameState.phase === "voting" && gameState.id && currentPlayerId) {
      const checkVote = async () => {
        try {
          // Fetch votes for current round
          const supabase = createClient()
          const { data: votes, error } = await supabase
            .from("votes")
            .select("target_id")
            .eq("room_id", gameState.id)
            .eq("round", gameState.currentRound)
            .eq("voter_id", currentPlayerId)
            .limit(1)

          if (!error && votes && votes.length > 0) {
            setVotedPlayerId(votes[0].target_id)
            setShowVotingPanel(false) // Don't show panel if already voted
            logger.log("[Vote] Found existing vote:", votes[0].target_id)
          } else {
            setVotedPlayerId(undefined)
            setShowVotingPanel(true) // Show panel if not voted yet
            logger.log("[Vote] No existing vote found for current player")
          }
        } catch (err) {
          console.error("Error checking vote:", err)
          // On error, show panel to allow voting
          setShowVotingPanel(true)
        }
      }
      checkVote()
    } else if (gameState.phase !== "voting") {
      // Clear voted player ID and hide panel when not in voting phase
      setVotedPlayerId(undefined)
      setShowVotingPanel(false)
    }
  }, [gameState.phase, gameState.id, gameState.currentRound, currentPlayerId])

  // Heartbeat mechanism - send ping every 10 seconds to indicate player is active
  // If player closes tab, heartbeat stops and after 30 seconds they will be removed
  useEffect(() => {
    if (!gameState?.id || !currentPlayerId) return

    let heartbeatInterval: NodeJS.Timeout | null = null

    const sendHeartbeat = async () => {
      try {
        await fetch("/api/game/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomId: gameState.id,
            playerId: currentPlayerId,
          }),
        }).catch((err) => {
          // Silently ignore errors - heartbeat failures shouldn't break the game
          logger.debug("[Heartbeat] Failed to send heartbeat:", err)
        })
      } catch (err) {
        logger.debug("[Heartbeat] Error sending heartbeat:", err)
      }
    }

    // Send initial heartbeat immediately
    sendHeartbeat()

    // Then send heartbeat every 10 seconds
    heartbeatInterval = setInterval(sendHeartbeat, 10000) // 10 seconds

    return () => {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval)
      }
    }
  }, [gameState?.id, currentPlayerId])

  // Timer check - periodically check if timer expired and refresh state
  // Skip timer check in manual mode
  useEffect(() => {
    if (!gameState.id || (gameState.phase !== "playing" && gameState.phase !== "voting")) {
      return
    }

    // Don't check timer in manual mode
    const roundMode = gameState.settings?.roundMode || "automatic"
    if (roundMode === "manual") {
      return
    }

    const roomId = gameState.id
    const phase = gameState.phase
    let timerExpiredRef = { current: false } // Track if timer already expired to avoid repeated refreshes

    const checkTimer = async () => {
      try {
        const response = await fetch("/api/game/timer/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId }),
        })

        if (response.ok) {
          const data = await response.json()
          // If timer expired and phase changed, refresh game state
          if (data.phaseChanged) {
            logger.log("[Timer] Phase changed, refreshing game state")
            timerExpiredRef.current = false // Reset expired flag on phase change
            refresh()
          } else if (data.expired && phase === "voting") {
            // Timer expired in voting phase - refresh state only once
            if (!timerExpiredRef.current) {
              logger.log("[Timer] Voting timer expired, refreshing state once")
              timerExpiredRef.current = true
              refresh()
            }
            // Don't refresh again - timer is expired, wait for host to end voting
          } else if (!data.expired) {
            // Timer is not expired, reset the flag
            timerExpiredRef.current = false
          }
        }
      } catch (err) {
        console.error("Error checking timer:", err)
      }
    }

    // Check timer every 2 seconds for more frequent updates
    const interval = setInterval(checkTimer, 2000)
    
    // Also check immediately
    checkTimer()

    return () => clearInterval(interval)
    // Use stable dependencies - roomId and phase from gameState, but capture them in closure
    // Don't include roundStartedAt as it can be undefined, which changes array size
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.id, gameState.phase, refresh])

  // Use chat messages from gameState
  const chatMessages = gameState.chatMessages || []

  // Track unread messages
  useEffect(() => {
    if (!chatMessages.length) {
      setUnreadMessagesCount(0)
      return
    }

    // Get the latest message ID
    const latestMessage = chatMessages[chatMessages.length - 1]
    const latestMessageId = latestMessage?.id

    if (showChat) {
      // If chat is open, mark all messages as read
      if (latestMessageId) {
        lastReadMessageIdRef.current = latestMessageId
      }
      setUnreadMessagesCount(0)
    } else {
      // If chat is closed, count unread messages
      if (lastReadMessageIdRef.current) {
        const unreadIndex = chatMessages.findIndex(m => m.id === lastReadMessageIdRef.current)
        if (unreadIndex >= 0 && unreadIndex < chatMessages.length - 1) {
          // There are messages after the last read message
          setUnreadMessagesCount(chatMessages.length - unreadIndex - 1)
        } else if (unreadIndex === chatMessages.length - 1) {
          // Last read message is the latest message, no unread
          setUnreadMessagesCount(0)
        } else {
          // Last read message not found (maybe was deleted), count all messages as potentially unread
          setUnreadMessagesCount(chatMessages.length)
        }
      } else {
        // First time or chat was never opened, count all messages as unread
        setUnreadMessagesCount(chatMessages.length)
      }
    }
  }, [chatMessages, showChat])

  // Initialize media when game is loaded and room is ready
  const [mediaInitialized, setMediaInitialized] = useState(false)
  
  useEffect(() => {
    // Логируем состояние для диагностики
    logger.log("[Media] Checking conditions for media initialization:", {
      loading,
      mediaSettingsLoading,
      roomId: gameState.id,
      currentPlayerId,
      mediaInitialized,
      autoRequestCamera: mediaSettings.autoRequestCamera,
      autoRequestMicrophone: mediaSettings.autoRequestMicrophone,
      allConditions: {
        notLoading: !loading,
        settingsLoaded: !mediaSettingsLoading,
        hasRoomId: !!gameState.id,
        hasPlayerId: !!currentPlayerId,
        notInitialized: !mediaInitialized,
        shouldRequest: (mediaSettings.autoRequestCamera || mediaSettings.autoRequestMicrophone),
      }
    })
    
    // Запрашиваем доступ только когда игра загружена и комната существует, и еще не инициализировали
    // Также проверяем настройки пользователя - должен ли автоматически запрашивать доступ
    if (
      !loading &&
      !mediaSettingsLoading &&
      gameState.id &&
      currentPlayerId &&
      !mediaInitialized &&
      (mediaSettings.autoRequestCamera || mediaSettings.autoRequestMicrophone)
    ) {
      logger.log("[Media] Conditions met - requesting camera/microphone access...", {
        loading,
        mediaSettingsLoading,
        roomId: gameState.id,
        currentPlayerId,
        mediaInitialized,
        settings: mediaSettings,
      })
      
      initializeMedia({
        video: mediaSettings.autoRequestCamera,
        audio: mediaSettings.autoRequestMicrophone,
      })
        .then((stream) => {
          if (stream) {
            logger.log("[Media] Successfully initialized media stream:", {
              streamId: stream.id,
              videoTracks: stream.getVideoTracks().length,
              audioTracks: stream.getAudioTracks().length,
            })
            
            // Применить настройки по умолчанию (включить/выключить треки)
            // Состояние обновится автоматически в хуке useWebRTC через useEffect
            const videoTracks = stream.getVideoTracks()
            videoTracks.forEach((track) => {
              track.enabled = mediaSettings.defaultCameraEnabled
              logger.log(`[Media] Video track ${track.id} enabled: ${track.enabled}`)
            })
            
            const audioTracks = stream.getAudioTracks()
            audioTracks.forEach((track) => {
              track.enabled = mediaSettings.defaultMicrophoneEnabled
              logger.log(`[Media] Audio track ${track.id} enabled: ${track.enabled}`)
            })
            
            // Проверить, что localStream обновился в useWebRTC
            setTimeout(() => {
              logger.log("[Media] Checking localStream after initialization:", {
                hasLocalStream: !!localStream,
                localStreamId: localStream?.id,
                videoEnabled,
                audioEnabled,
              })
            }, 100)
            
            setMediaInitialized(true)
          } else {
            // Stream is null (browser doesn't support or permission denied) - this is OK
            logger.log("[Media] Media unavailable (browser doesn't support or permission denied) - game will continue without video/audio")
            // Set initialized to true so we don't keep retrying automatically
            setMediaInitialized(true)
          }
        })
        .catch((err) => {
          // Детальное логирование ошибки - логируем саму ошибку и её свойства
          console.error("[Media] ❌ Caught error in initializeMedia:", err)
          console.error("[Media] Error type:", typeof err)
          console.error("[Media] Error constructor:", err?.constructor?.name)
          console.error("[Media] Error keys:", err ? Object.keys(err) : [])
          
          // Попробуем извлечь информацию об ошибке
          let errorName = "Unknown"
          let errorMessage = String(err)
          let errorCode: number | undefined = undefined
          
          if (err) {
            if (err instanceof DOMException) {
              errorName = err.name
              errorMessage = err.message
              errorCode = err.code
            } else if (err instanceof Error) {
              errorName = err.name
              errorMessage = err.message
            } else if (typeof err === 'object') {
              // Попробуем извлечь свойства напрямую
              errorName = (err as any).name || (err as any).errorName || "Unknown"
              errorMessage = (err as any).message || (err as any).errorMessage || String(err)
              errorCode = (err as any).code || (err as any).errorCode
            }
          }
          
          const errorDetails = {
            errorName,
            errorMessage,
            errorCode,
            errorObject: err,
            settings: mediaSettings,
            loading,
            roomId: gameState.id,
            currentPlayerId,
          }
          
          // Check if it's a permission error
          const isPermissionError = 
            errorName === "NotAllowedError" ||
            errorMessage.includes("Permission denied") ||
            errorMessage.includes("permission")
          
          if (isPermissionError) {
            logger.log("[Media] ⚠️ Permission denied - user can enable media manually via button", errorDetails)
            // Set initialized to true so we don't keep retrying
            setMediaInitialized(true)
          } else {
            console.error("[Media] ❌ Failed to initialize media (non-permission error):", errorDetails)
            // Не устанавливаем mediaInitialized в true при других ошибках, чтобы можно было повторить
          }
        })
    } else if (
      !loading &&
      gameState.id &&
      currentPlayerId &&
      !mediaInitialized &&
      !mediaSettings.autoRequestCamera &&
      !mediaSettings.autoRequestMicrophone
    ) {
      // Если пользователь отключил автозапрос, все равно устанавливаем флаг
      logger.log("[Media] Auto-request disabled by user settings")
      setMediaInitialized(true)
    } else {
      // Логируем, почему условие не выполнилось
      const reasons = []
      if (loading) reasons.push("gameState still loading")
      if (mediaSettingsLoading) reasons.push("mediaSettings still loading")
      if (!gameState.id) reasons.push("no roomId")
      if (!currentPlayerId) reasons.push("no currentPlayerId")
      if (mediaInitialized) reasons.push("already initialized")
      if (!mediaSettings.autoRequestCamera && !mediaSettings.autoRequestMicrophone) reasons.push("auto-request disabled")
      
      if (reasons.length > 0) {
        logger.log("[Media] Conditions NOT met - waiting:", reasons.join(", "))
      }
    }
  }, [loading, mediaSettingsLoading, gameState.id, currentPlayerId, initializeMedia, mediaInitialized, mediaSettings])

  // Update players with their streams (local and remote) — useMemo для избежания пересчёта при каждом рендере
  const playersWithStream = useMemo(() => {
    return gameState.players.map((player) => {
      if (player.id === currentPlayerId) {
        if (localStream) {
          return { ...player, stream: localStream, audioEnabled, videoEnabled }
        }
        return { ...player, stream: undefined, audioEnabled: false, videoEnabled: false }
      }
      if (remoteStreams?.has(player.id)) {
        const remoteStream = remoteStreams.get(player.id)!
        const vidEnabled = remoteStream.getVideoTracks().some((t) => t.enabled && t.readyState === "live")
        const audEnabled = remoteStream.getAudioTracks().some((t) => t.enabled && t.readyState === "live")
        return { ...player, stream: remoteStream, videoEnabled: vidEnabled, audioEnabled: audEnabled }
      }
      return player
    })
  }, [gameState.players, currentPlayerId, localStream, remoteStreams, videoEnabled, audioEnabled])

  const currentPlayer = gameState.players.find((p) => p.id === currentPlayerId)
  // Check if current user is host by comparing with gameState.hostId
  // This works even if host is in "host_only" mode and not in players list
  const [currentUserId, setCurrentUserId] = useState<string>("")
  
  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
      }
    }
    checkUser()
  }, [])
  
  const isHost = gameState.hostId === currentUserId
  
  // Check if user is a spectator (no currentPlayerId and user is in spectators list)
  const isSpectator = !currentPlayerId && currentUserId && gameState.spectators?.some((s) => s.userId === currentUserId)
  const eliminatedPlayers = gameState.players.filter((p) => p.isEliminated)
  const survivors = gameState.players.filter((p) => !p.isEliminated)

  // Do NOT send leave on beforeunload for anyone — refresh and tab close both trigger it.
  // Sending leave would remove players on refresh. Heartbeat removes inactive players instead:
  // host 90s, regular players 30s. The "Выйти" button still calls leave API explicitly.

  // Debug: Log when showCharacteristicsManager changes (after isHost is defined)
  useEffect(() => {
    logger.log("[GamePage] showCharacteristicsManager changed:", {
      isOpen: showCharacteristicsManager,
      isHost,
    })
  }, [showCharacteristicsManager, isHost])

  // Handle voting
  const handleVote = useCallback((targetId: string) => {
    setVotedPlayerId(targetId)
  }, [])

  const handleConfirmVote = useCallback(async (targetId?: string) => {
    const voteTargetId = targetId || votedPlayerId
    if (!voteTargetId || !castVote) return
    try {
      await castVote(voteTargetId)
      // Vote was successful, update votedPlayerId and close panel
      setVotedPlayerId(voteTargetId)
      logger.log("[Vote] Vote cast successfully for player:", voteTargetId)
      // Close voting panel after successful vote
      setShowVotingPanel(false)
    } catch (err) {
      // Better error logging - handle all error types
      let errorMessage = "Failed to cast vote"
      let errorDetails: any = null
      let errorString = ""
      
      // First, try to get a string representation
      try {
        errorString = String(err)
      } catch (e) {
        errorString = "[Unable to convert error to string]"
      }
      
      if (err instanceof Error) {
        // Extract message - handle case where message might contain [object Object]
        let msg = err.message || errorMessage
        
        // If message contains [object Object], try to get info from attached responseData
        if (msg.includes('[object Object]') && (err as any).responseData) {
          const responseData = (err as any).responseData
          console.error("[Vote] Extracting error from responseData in handleConfirmVote:", responseData)
          
          // Try multiple ways to extract error message
          if (responseData.error) {
            if (typeof responseData.error === 'string') {
              msg = responseData.error
            } else if (typeof responseData.error === 'object' && responseData.error.message) {
              msg = String(responseData.error.message)
            }
          }
          
          if ((!msg || msg.includes('[object Object]')) && responseData.message) {
            if (typeof responseData.message === 'string') {
              msg = responseData.message
            } else if (typeof responseData.message === 'object' && responseData.message.message) {
              msg = String(responseData.message.message)
            }
          }
          
          // Try to extract from details
          if ((!msg || msg.includes('[object Object]')) && responseData.details) {
            if (typeof responseData.details === 'string') {
              msg = responseData.details
            } else if (typeof responseData.details === 'object' && responseData.details.message) {
              msg = String(responseData.details.message)
            }
          }
          
          // Final fallback
          if (!msg || msg.includes('[object Object]')) {
            msg = `Server error (status: ${(err as any).status || 'unknown'})`
          }
        }
        
        // Clean up message - remove [object Object] if still present
        msg = msg.replace(/\[object Object\]/g, '').trim()
        if (!msg) {
          msg = errorMessage
        }
        
        errorMessage = msg
        errorDetails = err.stack
        errorString = `Error: ${err.name} - ${msg}`
      } else if (typeof err === "string") {
        errorMessage = err
        errorString = err
      } else if (err && typeof err === "object") {
        // Try to extract error information from object
        try {
          const errObj = err as any
          errorMessage = errObj.message || errObj.error || errObj.toString?.() || errorMessage
          // Try multiple methods to serialize
          try {
            errorDetails = JSON.stringify(err, Object.getOwnPropertyNames(err), 2)
          } catch {
            try {
              errorDetails = JSON.stringify(err, null, 2)
            } catch {
              errorDetails = `Object with keys: ${Object.keys(err).join(", ")}`
            }
          }
          errorString = errorMessage
        } catch (e) {
          // If all else fails, use string representation
          errorMessage = errorString || errorMessage
          errorDetails = `[Error serialization failed: ${e}]`
        }
      } else {
        errorMessage = errorString || errorMessage
      }
      
      // Log with multiple approaches to ensure we see something
      console.error("[Vote] Failed to cast vote:", errorString)
      console.error("[Vote] Failed to cast vote (detailed):", {
        error: errorMessage,
        details: errorDetails,
        targetId: voteTargetId,
        errorType: err?.constructor?.name || typeof err,
        errorString: errorString,
        rawError: err
      })
      
      // Also try to log error properties directly
      if (err && typeof err === "object") {
        try {
          const props = Object.getOwnPropertyNames(err)
          console.error("[Vote] Error properties:", props)
          props.forEach(prop => {
            try {
              const value = (err as any)[prop]
              console.error(`  ${prop}:`, value)
            } catch (e) {
              console.error(`  ${prop}: [unable to read]`)
            }
          })
        } catch (e) {
          console.error("[Vote] Could not enumerate error properties:", e)
        }
      }
      
      // Don't clear votedPlayerId on error - user can try again
    }
  }, [votedPlayerId, castVote])

  // Handle voting phase end
  const handleEndVoting = useCallback(async (playerId?: string) => {
    if (!gameState.id) return

    try {
      const roundMode = gameState.settings?.roundMode || "automatic"
      const body: any = { roomId: gameState.id }
      
      // In manual mode, if playerId is provided, use it
      if (roundMode === "manual" && playerId) {
        body.playerId = playerId
      }

      const response = await fetch("/api/game/eliminate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to end voting")
      }

      const data = await response.json()
      setVoteResults(data.results || [])
      setEliminatedId(data.eliminatedPlayerId || undefined)

      // Refresh game state to get updated phase and eliminated player
      refresh()
    } catch (err) {
      console.error("Error ending voting:", err)
    }
  }, [gameState.id, gameState.settings?.roundMode, refresh])

  const handleKickPlayer = useCallback(
    async (playerId: string) => {
      if (!gameState.id) return
      try {
        const res = await fetch("/api/game/kick", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId: gameState.id, playerId }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || "Не удалось исключить игрока")
        }
        refresh()
      } catch (err) {
        console.error("Kick error:", err)
        throw err
      }
    },
    [gameState.id, refresh]
  )

  const handleBanPlayer = useCallback(
    async (userId: string) => {
      if (!gameState.id) return
      try {
        const res = await fetch("/api/game/room/ban", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId: gameState.id, userId }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || "Не удалось забанить игрока")
        }
        refresh()
      } catch (err) {
        console.error("Ban error:", err)
        throw err
      }
    },
    [gameState.id, refresh]
  )

  const handleUnbanPlayer = useCallback(
    async (userId: string) => {
      if (!gameState.id) return
      try {
        const res = await fetch("/api/game/room/unban", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId: gameState.id, userId }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || "Не удалось разбанить игрока")
        }
        refresh()
      } catch (err) {
        console.error("Unban error:", err)
        throw err
      }
    },
    [gameState.id, refresh]
  )

  // Handle next round - in manual mode, this also ends voting and shows results
  const handleNextRound = useCallback(async () => {
    if (!gameState.id) return

    const roundMode = gameState.settings?.roundMode || "automatic"
    
    // In manual mode from voting phase, use nextRound API which will end voting and go to results
    if (roundMode === "manual" && gameState.phase === "voting") {
      try {
        const response = await fetch("/api/game/round/next", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId: gameState.id }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || "Failed to advance round")
        }

        const data = await response.json()
        
        // If API returned results (manual mode from voting), set them
        if (data.results && data.eliminatedPlayerId) {
          setVoteResults(data.results || [])
          setEliminatedId(data.eliminatedPlayerId)
        }
        
        // Refresh game state
        refresh()
      } catch (err) {
        console.error("Error advancing round:", err)
      }
      return
    }
    
    // Otherwise, proceed to next round normally
    nextRound()
  }, [gameState.id, gameState.phase, gameState.settings?.roundMode, refresh, nextRound])

  // Handle continue after results
  const handleContinueAfterResults = useCallback(() => {
    setVoteResults([])
    setEliminatedId(undefined)
    setVotedPlayerId(undefined)
    handleNextRound()
  }, [handleNextRound])

  // Handle send chat message
  const handleSendMessage = useCallback(
    async (message: string) => {
      if (!gameState.id || sendingMessage || !message.trim()) return

      setSendingMessage(true)
      try {
        const response = await fetch("/api/game/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomId: gameState.id,
            message: message.trim(),
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || "Failed to send message")
        }

        // Message will be added via realtime - no need to refresh
        // The message will appear instantly through the realtime subscription
      } catch (err) {
        console.error("Error sending message:", err)
      } finally {
        setSendingMessage(false)
      }
    },
    [gameState.id, sendingMessage, refresh],
  )

  // Handle reveal characteristic
  const handleRevealCharacteristic = useCallback(
    async (characteristicId: string) => {
      if (!currentPlayerId) return
      await revealCharacteristic(currentPlayerId, characteristicId)
      // System message will be added via API
      refresh()
    },
    [currentPlayerId, revealCharacteristic, refresh],
  )

  // Handle leave game
  const handleLeaveGame = useCallback(async () => {
    if (!gameState?.id || !currentPlayerId) {
      // If no game state or player ID, just redirect
      window.location.href = "/lobby"
      return
    }

    try {
      // Call API to leave room
      const response = await fetch("/api/game/leave", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomId: gameState.id,
          playerId: currentPlayerId,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        console.error("[Leave] Failed to leave room:", data.error)
        // Still redirect even if API call fails
      } else {
        const data = await response.json()
        if (data.roomClosed) {
          logger.log("[Leave] Room closed because host left")
        }
      }
    } catch (error) {
      console.error("[Leave] Error calling leave API:", error)
      // Still redirect even if API call fails
    }

    // Redirect to lobby
    window.location.href = "/lobby"
  }, [gameState?.id, currentPlayerId])

  // Handle start game
  const handleStartGame = useCallback(async () => {
    await startGame()
    // Don't manage local state - rely on server state
    // System message will be added via API
    refresh()
  }, [startGame, refresh])

  // Handle skipping catastrophe intro screen
  // This will update roundStartedAt on the server, which will trigger realtime updates for all players
  const handleSkipCatastropheIntro = useCallback(async () => {
    if (!gameState.id) return
    try {
      const response = await fetch("/api/game/catastrophe/skip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: gameState.id }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error("Error skipping catastrophe intro:", error)
        return
      }

      // Don't set local state - rely on server state update via realtime subscription
      // All players will automatically get the update when roundStartedAt changes
      refresh() // Refresh game state to start timer immediately
    } catch (err) {
      console.error("Error skipping catastrophe intro:", err)
    }
  }, [gameState.id, refresh])

  // Check if catastrophe intro should be shown
  // Show intro only if: playing phase, round 1, and timer hasn't started yet
  // This will automatically hide for all players when host skips (roundStartedAt is set)
  // Use useMemo to stabilize the condition and prevent flickering
  const showCatastropheIntro = useMemo(() => {
    // Only check when game is loaded and not refreshing
    if (loading || !gameState.id) return false
    
    // Кто Я? mode — не показываем интро катастрофы
    if ((gameState.settings as any)?.gameMode === "whoami") return false
    
    // Must be in playing phase, round 1
    if (gameState.phase !== "playing" || gameState.currentRound !== 1) return false
    
    // Must have catastrophe set
    if (!gameState.catastrophe) return false
    
    // Timer must not have started (roundStartedAt must be null/undefined)
    if (gameState.roundStartedAt) return false
    
    return true
  }, [
    loading,
    gameState.id,
    gameState.settings,
    gameState.phase,
    gameState.currentRound,
    gameState.roundStartedAt, // Only this should change to hide the intro
    gameState.catastrophe,
  ])
  
  // Debug logging for catastrophe intro display (only log when condition changes)
  const prevShowCatastropheIntro = useRef(false)
  useEffect(() => {
    if (prevShowCatastropheIntro.current !== showCatastropheIntro) {
      prevShowCatastropheIntro.current = showCatastropheIntro
      logger.log("[CatastropheIntro] Display state changed:", {
        loading,
        phase: gameState.phase,
        currentRound: gameState.currentRound,
        roundStartedAt: gameState.roundStartedAt,
        hasCatastrophe: !!gameState.catastrophe,
        shouldShow: showCatastropheIntro,
      })
    }
  }, [showCatastropheIntro, loading, gameState.phase, gameState.currentRound, gameState.roundStartedAt, gameState.catastrophe])

  // Load special cards when game state changes
  useEffect(() => {
    logger.log("[SpecialCards] 🔄 useEffect triggered:", {
      phase: gameState?.phase,
      playerId: currentPlayerId,
      roomId: gameState?.id,
      shouldLoad: gameState?.phase !== "waiting" && currentPlayerId && gameState?.id,
    })
    
    if (gameState?.phase !== "waiting" && currentPlayerId && gameState?.id) {
      // Fetch special cards from API
      const loadCards = async () => {
        try {
          logger.log("[SpecialCards] 🔍 Loading cards for player:", currentPlayerId, "room:", gameState.id)
          logger.log("[SpecialCards] Request URL:", `/api/game/special-cards?playerId=${currentPlayerId}&roomId=${gameState.id}`)
          
          const response = await fetch(
            `/api/game/special-cards?playerId=${currentPlayerId}&roomId=${gameState.id}`
          )
          
          logger.log("[SpecialCards] 📥 Response status:", response.status, response.statusText)
          
          if (response.ok) {
            const data = await response.json()
            logger.log("[SpecialCards] ✅ Received cards data:", data)
            // Transform database cards to component format
            const rawCards = data.cards || []
            logger.log(`[SpecialCards] 📊 Raw cards count: ${rawCards.length}`)
            
            if (rawCards.length === 0) {
              logger.warn(`[SpecialCards] ⚠️ No cards returned from API for player ${currentPlayerId} in room ${gameState.id}`)
              logger.warn("[SpecialCards] This means cards were not granted when game started, or player ID doesn't match")
              logger.warn("[SpecialCards] Check server logs for [GameStart] messages to see if cards were granted")
            }
            
            const transformedCards = rawCards.map((card: any) => {
              const cardName = getCardName(card.card_type)
              const cardDescription = getCardDescription(card.card_type)
              logger.log(`[SpecialCards] 🔄 Transforming card ${card.id}: type="${card.card_type || 'null'}", name="${cardName || 'empty'}", description="${cardDescription || 'empty'}", is_used=${card.is_used}`)
              
              // Filter out cards without name (invalid card types)
              // Description can be empty for some cards, but name must exist
              if (!cardName || cardName.trim() === "") {
                logger.warn(`[SpecialCards] ⚠️ Card ${card.id} has invalid type "${card.card_type || 'null'}" - missing name. Card data:`, card)
                return null
              }
              
              return {
                id: card.id,
                name: cardName,
                description: cardDescription || `Карта типа "${card.card_type}"`, // Fallback description
                type: card.card_type,
                isUsed: card.is_used || false,
              }
            }).filter((card: any) => card !== null) // Remove invalid cards
            
            const invalidCount = rawCards.length - transformedCards.length
            if (invalidCount > 0) {
              logger.warn(`[SpecialCards] ⚠️ Filtered out ${invalidCount} invalid card(s)`)
            }
            
            logger.log("[SpecialCards] ✅ Transformed cards (after filtering):", transformedCards)
            logger.log("[SpecialCards] 📊 Available cards (not used):", transformedCards.filter((c) => !c.isUsed))
            
            if (transformedCards.length === 0) {
              // This is expected if cards haven't been granted yet or all cards are used
              if (rawCards.length === 0) {
                logger.warn(`[SpecialCards] ⚠️ No cards found for player ${currentPlayerId} in room ${gameState.id}`)
                logger.warn("[SpecialCards] Possible reasons:")
                logger.warn("[SpecialCards]   1. Cards were not granted when game started")
                logger.warn("[SpecialCards]   2. Player ID doesn't match any granted cards")
                logger.warn("[SpecialCards]   3. Room ID doesn't match any granted cards")
                logger.warn("[SpecialCards] Check server logs for [GameStart] messages")
              } else {
                logger.warn(`[SpecialCards] ⚠️ No valid cards after transformation! Raw cards: ${rawCards.length}, Invalid: ${invalidCount}`)
                if (rawCards.length > 0) {
                  logger.warn("[SpecialCards] Raw card types:", rawCards.map((c: any) => c.card_type))
                }
              }
            } else if (transformedCards.filter((c) => !c.isUsed).length === 0) {
              logger.log("[SpecialCards] ℹ️ All cards are marked as used (this is normal after using all cards)")
            } else {
              logger.log(`[SpecialCards] ✅ Successfully loaded ${transformedCards.length} cards (${transformedCards.filter((c) => !c.isUsed).length} available)`)
            }
            
            setSpecialCards(transformedCards)
          } else {
            const errorData = await response.json().catch(() => ({}))
            console.error("[SpecialCards] ❌ Failed to load cards:", {
              status: response.status,
              statusText: response.statusText,
              error: errorData,
            })
          }
        } catch (err) {
          console.error("[SpecialCards] ❌ Error loading special cards:", {
            error: err,
            errorName: err instanceof Error ? err.name : typeof err,
            errorMessage: err instanceof Error ? err.message : String(err),
          })
        }
      }
      loadCards()
    } else {
      logger.log("[SpecialCards] ⏭️ Skipping load - conditions not met:", {
        phase: gameState?.phase,
        playerId: currentPlayerId,
        roomId: gameState?.id,
      })
      // Clear cards when conditions are not met
      setSpecialCards([])
    }
  }, [gameState?.phase, gameState?.id, currentPlayerId])

  // Subscribe to special card used events
  const specialCardChannelRef = useRef<any>(null)
  useEffect(() => {
    if (!gameState?.id) return

    const supabase = createClient()
    const channel = supabase.channel(`room:${gameState.id}`, {
      config: {
        broadcast: { self: false },
      },
    })

    channel.on("broadcast", { event: "special_card_used" }, ({ payload }) => {
      setModalQueue((prev) => [
        ...prev,
        {
          type: "special-card",
          data: {
            playerName: payload.playerName,
            cardName: payload.cardName,
            cardDescription: payload.cardDescription,
            cardType: payload.cardType,
          },
        },
      ])
    })

    channel.on("broadcast", { event: "bunker_characteristic_revealed" }, ({ payload }) => {
      setModalQueue((prev) => [
        ...prev,
        {
          type: "bunker-char",
          data: {
            characteristicName: payload.characteristicName,
            characteristicType: payload.characteristicType,
          },
        },
      ])
    })

    channel.subscribe()
    specialCardChannelRef.current = channel

    return () => {
      channel.unsubscribe()
      specialCardChannelRef.current = null
    }
  }, [gameState?.id])
  
  // Track previous bunker info to detect new reveals via state changes
  const prevBunkerInfoRef = useRef<{ totalRevealed?: number } | null>(null)
  
  // Check for newly revealed bunker characteristic when gameState changes
  useEffect(() => {
    if (!gameState?.bunkerInfo) {
      prevBunkerInfoRef.current = null
      return
    }
    
    const currentTotalRevealed = gameState.bunkerInfo.totalRevealed || 0
    const currentRevealed = gameState.bunkerInfo.revealedCharacteristics || []
    const prevTotalRevealed = prevBunkerInfoRef.current?.totalRevealed || 0
    
    // If totalRevealed increased, a new characteristic was revealed
    if (currentTotalRevealed > prevTotalRevealed && currentRevealed.length > 0) {
      // Get the most recently revealed characteristic (last in array)
      const lastRevealed = currentRevealed[currentRevealed.length - 1]
      
      if (lastRevealed && lastRevealed.name && lastRevealed.type) {
        setModalQueue((prev) => [
          ...prev,
          {
            type: "bunker-char",
            data: {
              characteristicName: lastRevealed.name,
              characteristicType: lastRevealed.type,
            },
          },
        ])
      }
    }
    
    // Update ref with current state
    prevBunkerInfoRef.current = {
      totalRevealed: currentTotalRevealed,
    }
  }, [gameState?.bunkerInfo?.totalRevealed])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      const target = event.target as HTMLElement
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return
      }

      // Check for Shift+U (case insensitive) - only in dev mode
      if (showDebug && event.shiftKey && (event.key === "U" || event.key === "u" || event.key.toLowerCase() === "u")) {
        event.preventDefault()
        event.stopPropagation()
        setShowDebugInfo((prev) => {
          const newValue = !prev
          logger.debug("[Debug] Toggling debug info:", newValue)
          return newValue
        })
        setShowRefreshIndicator((prev) => {
          const newValue = !prev
          logger.debug("[Debug] Toggling refresh indicator:", newValue)
          return newValue
        })
      }

      // Y or н (Cyrillic) - toggle tease panel (camera effects)
      const teaseKeys = ["y", "Y", "н", "Н"]
      if (!event.shiftKey && (teaseKeys.includes(event.key) || event.code === "KeyY")) {
        event.preventDefault()
        setShowTeasePanel((prev) => !prev)
        return
      }

      // N or т (Cyrillic) - toggle top panel (header + catastrophe banner)
      const topPanelKeys = ["n", "N", "т", "Т"]
      if (!event.shiftKey && (topPanelKeys.includes(event.key) || event.code === "KeyN")) {
        event.preventDefault()
        setTopPanelVisible((prev) => !prev)
        return
      }

      // Модальные окна — только одно активно. Не открывать новые, пока открыто голосование, результаты или очередь.
      const isModalOpen =
        showChat ||
        showSpecialCards ||
        showBunkerInfo ||
        showCharacteristicsManager ||
        selectedPlayer !== null ||
        modalQueue.length > 0 ||
        (gameState.phase === "voting" && showVotingPanel) ||
        (gameState.phase === "results" && voteResults.length > 0)

      // е or t - toggle chat (KeyT = physical key for "е" in Russian layout)
      if (!event.shiftKey && (event.key === "t" || event.key === "T" || event.key === "е" || event.key === "Е" || event.code === "KeyT")) {
        event.preventDefault()
        if (showChat) {
          setShowChat(false)
        } else if (!isModalOpen) {
          setShowChat(true)
        }
        return
      }

      // И or B - toggle bottom panel (GameControls)
      // event.code KeyB = physical B key (produces "и" in Russian layout)
      if (!event.shiftKey && (event.key === "b" || event.key === "B" || event.key === "и" || event.key === "И" || event.code === "KeyB")) {
        event.preventDefault()
        setBottomPanelVisible((prev) => !prev)
        return
      }

      const gameMode = (gameState.settings as any)?.gameMode || "bunker"

      // ц or w - toggle Спец. карты (только в режиме Бункер)
      const specialCardsKeys = ["w", "W", "ц", "Ц"]
      if (gameMode !== "whoami" && (gameState.phase === "playing" || gameState.phase === "voting") && !event.shiftKey && specialCardsKeys.includes(event.key) && !isSpectator) {
        event.preventDefault()
        if (showSpecialCards) {
          setShowSpecialCards(false)
        } else if (!isModalOpen) {
          setShowSpecialCards(true)
        }
        return
      }

      // Shortcuts only in playing phase
      if (gameState.phase !== "playing") return

      // й or q - toggle Мои характеристики / Мои слова
      const myCharsKeys = ["q", "Q", "й", "Й"]
      if (!event.shiftKey && myCharsKeys.includes(event.key) && !isSpectator) {
        event.preventDefault()
        const cp = gameState.players.find((p) => p.id === currentPlayerId)
        if (cp) {
          const isMyCharsOpen = selectedPlayer?.id === cp.id
          if (isMyCharsOpen) {
            setSelectedPlayer(null)
          } else if (!isModalOpen) {
            setSelectedPlayer(cp)
          }
        }
        return
      }

      // у or e - toggle Бункер (только в режиме Бункер)
      const bunkerKeys = ["e", "E", "у", "У"]
      if (gameMode !== "whoami" && !event.shiftKey && bunkerKeys.includes(event.key)) {
        event.preventDefault()
        if (showBunkerInfo) {
          setShowBunkerInfo(false)
        } else if (!isModalOpen) {
          setShowBunkerInfo(true)
        }
        return
      }

      // к or r - toggle Управление (host only)
      const manageKeys = ["r", "R", "к", "К"]
      if (!event.shiftKey && manageKeys.includes(event.key) && isHost) {
        event.preventDefault()
        if (showCharacteristicsManager) {
          setShowCharacteristicsManager(false)
        } else if (!isModalOpen) {
          setShowCharacteristicsManager(true)
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown, true) // Use capture phase
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true)
    }
  }, [
    gameState.phase,
    gameState.settings,
    gameState.players,
    currentPlayerId,
    isSpectator,
    isHost,
    showChat,
    showSpecialCards,
    showBunkerInfo,
    showCharacteristicsManager,
    selectedPlayer,
    modalQueue.length,
    showVotingPanel,
    voteResults.length,
  ])

  const getCardDescription = (type: string | null | undefined) => {
    // Handle null/undefined types
    if (!type || typeof type !== "string" || type.trim() === "") {
      return ""
    }
    
    // Category-specific exchange cards
    if (type.startsWith("exchange-")) {
      const category = type.replace("exchange-", "")
      const categoryLabels: Record<string, string> = {
        gender: "Пол",
        age: "Возраст",
        profession: "Профессия",
        health: "Здоровье",
        hobby: "Хобби",
        phobia: "Фобия",
        baggage: "Багаж",
        fact: "Факт",
        special: "Особое",
        bio: "Биология",
        skill: "Навык",
        trait: "Черта",
        additional: "Дополнительное",
      }
      const categoryLabel = categoryLabels[category] || category
      // Only return valid description if category is recognized
      if (categoryLabels[category]) {
        return `Обменяйте свою характеристику категории "${categoryLabel}" с другим игроком`
      }
      // Invalid exchange category
      return ""
    }
    
    // Category-specific reshuffle cards
    if (type.startsWith("reshuffle-")) {
      const category = type.replace("reshuffle-", "")
      const categoryLabels: Record<string, string> = {
        health: "здоровья",
        bio: "биологии",
        fact: "фактов",
        baggage: "багажа",
        hobby: "хобби",
      }
      const categoryLabel = categoryLabels[category] || category
      // Only return valid description if category is recognized
      if (categoryLabels[category]) {
        return `Соберите все открытые карты категории "${categoryLabel}", перемешайте и перераздайте`
      }
      // Invalid reshuffle category
      return ""
    }
    
    const descriptions: Record<string, string> = {
      exchange: "Обменяйте одну из своих характеристик с другим игроком",
      peek: "Посмотрите одну скрытую характеристику другого игрока",
      immunity: "Защитите себя от изгнания на этом раунде",
      reroll: "Перегенерируйте одну из своих характеристик",
      reveal: "Раскройте одну характеристику другого игрока для всех",
      steal: "Украдите одну характеристику у другого игрока",
      "double-vote": "Ваш голос считается за два в этом голосовании",
      "no-vote-against": "Выбранный игрок до конца игры не голосует против вас",
      reshuffle: "Соберите все открытые карты определенной категории, перемешайте и перераздайте",
      revote: "Сбросить все голоса; никто не может голосовать против вас до конца игры",
      "replace-profession": "Замените открытую карту профессии любого игрока на случайную из колоды",
      "replace-health": "Замените открытую карту здоровья любого игрока на случайную из колоды",
    }
    return descriptions[type] || ""
  }

  const getCardName = (type: string | null | undefined) => {
    // Handle null/undefined types
    if (!type || typeof type !== "string" || type.trim() === "") {
      return ""
    }
    
    // Category-specific exchange cards
    if (type.startsWith("exchange-")) {
      const category = type.replace("exchange-", "")
      const categoryLabels: Record<string, string> = {
        gender: "Пол",
        age: "Возраст",
        profession: "Профессия",
        health: "Здоровье",
        hobby: "Хобби",
        phobia: "Фобия",
        baggage: "Багаж",
        fact: "Факт",
        special: "Особое",
        bio: "Биология",
        skill: "Навык",
        trait: "Черта",
        additional: "Дополнительное",
      }
      const categoryLabel = categoryLabels[category] || category
      // Only return valid name if category is recognized, otherwise empty string
      if (categoryLabels[category]) {
        return `Обмен ${categoryLabel.toLowerCase()}`
      }
      // Invalid exchange category
      return ""
    }
    
    // Category-specific reshuffle cards
    if (type.startsWith("reshuffle-")) {
      const category = type.replace("reshuffle-", "")
      const categoryLabels: Record<string, string> = {
        health: "Здоровья",
        bio: "Биологии",
        fact: "Фактов",
        baggage: "Багажа",
        hobby: "Хобби",
      }
      const categoryLabel = categoryLabels[category] || category
      // Only return valid name if category is recognized, otherwise empty string
      if (categoryLabels[category]) {
        return `Давайте начистоту: ${categoryLabel}`
      }
      // Invalid reshuffle category
      return ""
    }
    
    const names: Record<string, string> = {
      exchange: "Обмен характеристикой",
      peek: "Подглядывание",
      immunity: "Иммунитет",
      reroll: "Перебросить",
      reveal: "Раскрыть карту",
      steal: "Украсть характеристику",
      "double-vote": "Громкий голос",
      "no-vote-against": "Будь другом",
      reshuffle: "Давайте начистоту",
      revote: "План Б",
      "replace-profession": "Фейковый диплом",
      "replace-health": "Просроченные таблетки",
    }
    // Return empty string for unknown types instead of the type itself
    return names[type] || ""
  }

  const handleUseSpecialCard = useCallback(
    async (cardId: string, targetPlayerId?: string, characteristicId?: string, category?: string) => {
      if (!gameState || !currentPlayerId || !useSpecialCard) return

      const card = specialCards.find((c) => c.id === cardId)
      if (!card) return

      try {
        await useSpecialCard(cardId, card.type, targetPlayerId, characteristicId, category)

        // Update local state
        setSpecialCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, isUsed: true } : c)))

        // Broadcast card usage to all players
        if (currentPlayer && specialCardChannelRef.current) {
          await specialCardChannelRef.current.send({
            type: "broadcast",
            event: "special_card_used",
            payload: {
              playerName: currentPlayer.name,
              cardName: card.name,
              cardDescription: card.description,
              cardType: card.type,
            },
          })
        }
        // Текущий игрок не получает свой broadcast (self: false), добавляем в очередь вручную
        if (currentPlayer) {
          setModalQueue((prev) => [
            ...prev,
            {
              type: "special-card",
              data: {
                playerName: currentPlayer.name,
                cardName: card.name,
                cardDescription: card.description,
                cardType: card.type,
              },
            },
          ])
        }

        // System message will be added by API via realtime subscription
        // No need to manually add it here - it will appear in gameState.chatMessages
      } catch (err) {
        // Error is already handled in useSpecialCard
        // Don't log expected errors for eliminated players
        const errorMessage = err instanceof Error ? err.message : String(err)
        if (!errorMessage.includes("Eliminated players cannot use special cards")) {
          console.error("Error using special card:", err)
        }
      }
    },
    [gameState, currentPlayerId, specialCards, useSpecialCard, currentPlayer],
  )

  const handlePlayAgain = useCallback(() => {
    window.location.reload()
  }, [])

  // Show loading state
  // Only show full loading screen on initial load when we have no game state
  // Don't redirect during loading - wait for game state to load
  if (loading && !gameState) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Загрузка игры...</p>
        </div>
      </div>
    )
  }

  // Don't show error or redirect if we're still loading or refreshing
  // This prevents premature redirects during page refresh
  if (loading || isRefreshing) {
    // Show existing game state if available, or loading indicator
    if (gameState) {
      // Continue rendering with existing state during refresh
    } else {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Загрузка игры...</p>
          </div>
        </div>
      )
    }
  }

  // Show error state
  // Redirect to lobby if room was deleted
  useEffect(() => {
    if (error === "ROOM_DELETED") {
      logger.log("[GamePage] Room was deleted, redirecting to lobby")
      // Small delay to show message if needed
      setTimeout(() => {
        router.push("/lobby")
      }, 1500)
    }
  }, [error, router])

  if (error === "ROOM_DELETED") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md space-y-4">
          <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto" />
          <h2 className="text-2xl font-bold">Комната была закрыта</h2>
          <p className="text-muted-foreground">Хост покинул игру. Перенаправление в лобби...</p>
        </div>
      </div>
    )
  }

  // Don't show error immediately if we're still loading - wait for load to complete
  // This prevents showing errors during page refresh when state is being restored
  if (error && !loading && !isRefreshing) {
    // Only show error if it's not "Not authenticated" (which might be temporary during refresh)
    if (error === "Not authenticated") {
      const loginUrl = `/auth/login?redirect=${encodeURIComponent(`/game/${roomCode}`)}`
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center max-w-md space-y-4">
            <p className="text-muted-foreground">Чтобы зайти в комнату, войдите в аккаунт.</p>
            <a
              href={loginUrl}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
            >
              Войти
            </a>
          </div>
        </div>
      )
    }
    
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md">
          <p className="text-destructive mb-4">{error}</p>
          <button
            onClick={() => window.location.href = "/lobby"}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Вернуться в лобби
          </button>
        </div>
      </div>
    )
  }

  // Show waiting room if game hasn't started
  if (gameState.phase === "waiting") {
    return (
      <WaitingRoom
        gameState={gameState}
        currentPlayerId={currentPlayerId}
        isHost={isHost}
        onStartGame={handleStartGame}
        onLeaveGame={handleLeaveGame}
        onToggleReady={toggleReady}
      />
    )
  }

  if (gameState.phase === "finished") {
    return (
      <GameResults
        gameState={gameState}
        survivors={survivors}
        eliminated={eliminatedPlayers}
        onPlayAgain={handlePlayAgain}
        onBackToLobby={handleLeaveGame}
      />
    )
  }

  return (
    <div className="h-dvh max-h-dvh min-h-0 bg-background flex flex-col relative overflow-hidden">
      {/* Subtle refresh indicator in top-right corner (hidden by default, toggle with Shift+U) */}
      {showDebug && isRefreshing && showRefreshIndicator && (
        <div className="fixed top-4 right-4 z-50 bg-background/80 backdrop-blur-sm border rounded-lg px-3 py-2 shadow-lg flex items-center gap-2">
          <Loader2 className="h-4 w-4 text-primary animate-spin" />
          <span className="text-sm text-muted-foreground">Обновление...</span>
        </div>
      )}
      {/* Connection Status - Hide for eliminated players */}
      {!currentPlayer?.isEliminated && (
        <ConnectionStatus
          isConnected={connectionState === "connected"}
          isReconnecting={connectionState === "reconnecting"}
          onRetry={reconnect}
        />
      )}
      <OnlineStatus />

      {/* Catastrophe Intro Screen */}
      {showCatastropheIntro && gameState.catastrophe && (
        <CatastropheIntroScreen
          catastrophe={gameState.catastrophe}
          bunkerDescription={gameState.bunkerDescription}
          roundMode={gameState.settings?.roundMode || "automatic"}
          isHost={isHost}
          onContinue={handleSkipCatastropheIntro}
        />
      )}

      {/* Media loading indicator */}
      {isMediaLoading && !localStream && (
        <div className="bg-primary/10 border-b border-primary/30 px-4 py-2 text-sm text-primary">
          <div className="max-w-7xl mx-auto flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            <span>Подключение камеры и микрофона…</span>
          </div>
        </div>
      )}

      {/* Media error banner */}
      {mediaError && !localStream && !isMediaLoading && (
        <div className="bg-destructive/20 border-b border-destructive/50 px-4 py-2 text-sm text-destructive">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
            <span className="flex-1 min-w-0">{mediaError}</span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  initializeMedia().catch((err) => {
                    console.error("[Media] Failed to initialize media:", err)
                  })
                }}
                className="px-3 py-1 bg-destructive/20 hover:bg-destructive/30 rounded text-xs font-medium"
              >
                Попробовать снова
              </button>
              <button
                onClick={clearMediaError}
                className="p-1.5 rounded hover:bg-destructive/30 transition-colors"
                title="Закрыть"
                aria-label="Закрыть"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hide main game content when showing catastrophe intro */}
      {/* Fallback: Always show content if not in waiting/finished phase and catastrophe intro conditions are not met */}
      {(!showCatastropheIntro || gameState.phase !== "playing" || gameState.currentRound !== 1) && (
        <>
          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              topPanelVisible ? "max-h-[220px] opacity-100" : "max-h-0 opacity-0"
            }`}
          >
          <div
            className={`shrink-0 transition-transform duration-300 ease-in-out ${
              topPanelVisible ? "translate-y-0" : "-translate-y-full"
            }`}
          >
          <GameHeader
            gameState={gameState}
            unreadMessagesCount={unreadMessagesCount}
            onOpenChat={() => {
              setShowChat(true)
              // Mark messages as read when opening chat
              if (chatMessages.length > 0) {
                lastReadMessageIdRef.current = chatMessages[chatMessages.length - 1]?.id || null
                setUnreadMessagesCount(0)
              }
            }}
            onOpenSettings={() => setShowSettings(true)}
            onOpenJournal={() => setShowJournal(true)}
            onOpenAltar={() => setShowAltar(true)}
            onTimerEnd={() => {
              // Автоматически начать голосование когда таймер истекает
              // Проверяем, что игра еще в фазе playing (может быть уже автоматически перешла через сервер)
              if (gameState.phase === "playing" && isHost) {
                startVoting().catch((err) => {
                  // Если произошла ошибка (например, игра уже в voting), просто обновим состояние
                  logger.log("[Timer] Error starting voting from timer:", err)
                  refresh()
                })
              }
            }}
          />

          {(gameState.settings as any)?.gameMode !== "whoami" && (
            <CatastropheBanner catastrophe={gameState.catastrophe} bunkerDescription={gameState.bunkerDescription} />
          )}
          </div>
          </div>

          <main className={`flex-1 min-h-0 overflow-hidden flex flex-col min-w-0 transition-[padding] duration-300 ${bottomPanelVisible ? "pb-20" : "pb-0"}`}>
            <PlayerGrid
              players={playersWithStream}
              maxPlayers={gameState.maxPlayers}
              currentPlayerId={currentPlayerId}
              gameMode={(gameState.settings as any)?.gameMode || "bunker"}
              onToggleCharacteristic={toggleCharacteristic}
              onSelectPlayer={setSelectedPlayer}
              mutedPlayers={mutedPlayers}
              onTogglePlayerMute={togglePlayerMute}
              vdoNinjaCameraUrl={mediaSettings.vdoNinjaCameraUrl}
              cameraEffects={cameraEffects}
              onCameraEffectDrop={handleCameraEffectDrop}
              onCameraEffectComplete={handleCameraEffectComplete}
            />
          </main>

          <CameraEffectsPanel
            open={showTeasePanel}
            onClose={() => setShowTeasePanel(false)}
            isPremium={isPremium}
          />

          <div
            className={`fixed bottom-0 left-0 right-0 z-40 min-h-[72px] transition-transform duration-300 ease-in-out ${
              bottomPanelVisible ? "translate-y-0" : "translate-y-full"
            }`}
          >
          <GameControls
            gameMode={(gameState.settings as any)?.gameMode || "bunker"}
            onOpenTeasePanel={() => setShowTeasePanel((p) => !p)}
            showTeasePanel={showTeasePanel}
            onReconnectVideo={reconnectVideo}
            isMediaLoading={isMediaLoading}
        isHost={isHost}
        isSpectator={!!isSpectator}
        currentPhase={gameState.phase}
        allPlayersMuted={allPlayersMuted}
        onToggleAllPlayersMute={toggleAllPlayersMute}
        audioEnabled={audioEnabled}
        videoEnabled={videoEnabled}
        hasLocalStream={!!localStream}
        onToggleMic={toggleAudio}
        onToggleVideo={toggleVideo}
        onRequestMedia={async () => {
          logger.log("[Media] 🔘 Manual media request triggered (user clicked button)")
          logger.log("[Media] Current state:", {
            hasLocalStream: !!localStream,
            mediaInitialized,
            mediaError,
            audioEnabled,
            videoEnabled,
            timestamp: new Date().toISOString(),
          })
          
          // Проверка перед запросом
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            logger.warn("[Media] ⚠️ Browser doesn't support getUserMedia - media features will be unavailable")
            // Don't show alert, just silently fail - user can still use the app without media
            return
          }
          
          // Проверка разрешений (если поддерживается)
          try {
            if (navigator.permissions && navigator.permissions.query) {
              const cameraPermission = await navigator.permissions.query({ name: 'camera' as PermissionName })
              const microphonePermission = await navigator.permissions.query({ name: 'microphone' as PermissionName })
              
              logger.log("[Media] Permission status before request:", {
                camera: cameraPermission.state,
                microphone: microphonePermission.state,
              })
              
              if (cameraPermission.state === 'denied' || microphonePermission.state === 'denied') {
                const blockedDevices = []
                if (cameraPermission.state === 'denied') blockedDevices.push('камера')
                if (microphonePermission.state === 'denied') blockedDevices.push('микрофон')
                
                alert(`Доступ к ${blockedDevices.join(' и ')} заблокирован в настройках браузера.\n\nЧтобы исправить:\n1. Нажмите на значок замка 🔒 в адресной строке\n2. Найдите настройки камеры/микрофона\n3. Измените с "Заблокировано" на "Разрешить"\n4. Обновите страницу`)
                return
              }
            }
          } catch (permError) {
            logger.log("[Media] Permissions API check failed (this is OK):", permError)
          }
          
          setMediaInitialized(false) // Сбрасываем флаг, чтобы можно было повторить
          
          logger.log("[Media] 🚀 Calling initializeMedia with video:true, audio:true")
          logger.log("[Media] This should trigger browser permission dialog...")
          
          initializeMedia({
            video: true,
            audio: true,
          })
            .then((stream) => {
              logger.log("[Media] ✅ Manual media request - initializeMedia returned:", {
                hasStream: !!stream,
                streamId: stream?.id,
                videoTracks: stream?.getVideoTracks().length || 0,
                audioTracks: stream?.getAudioTracks().length || 0,
              })
              
              if (stream) {
                logger.log("[Media] ✅ Manual media request successful!", {
                  streamId: stream.id,
                  videoTracks: stream.getVideoTracks().map(t => ({
                    id: t.id,
                    label: t.label,
                    enabled: t.enabled,
                    readyState: t.readyState,
                  })),
                  audioTracks: stream.getAudioTracks().map(t => ({
                    id: t.id,
                    label: t.label,
                    enabled: t.enabled,
                    readyState: t.readyState,
                  })),
                })
                setMediaInitialized(true)
              } else {
                logger.warn("[Media] ⚠️ Manual media request - stream is null (permission denied or error)")
              }
            })
            .catch((err) => {
              console.error("[Media] ❌ Manual media request - initializeMedia failed:", {
                error: err,
                errorName: err instanceof Error ? err.name : typeof err,
                errorMessage: err instanceof Error ? err.message : String(err),
              })
              // Оставляем возможность повторить
            })
        }}
        onRevealCharacteristic={() => setShowRevealModal(true)}
        onViewMyCharacteristics={(gameState.settings as any)?.gameMode === "whoami" ? undefined : () => {
          logger.log("[GameControls] onViewMyCharacteristics clicked", {
            currentPlayerId,
            currentPlayer: currentPlayer ? { id: currentPlayer.id, name: currentPlayer.name } : null,
            playersCount: gameState.players.length,
            allPlayerIds: gameState.players.map(p => p.id),
          })
          if (currentPlayer) {
            setSelectedPlayer(currentPlayer)
            logger.log("[GameControls] Selected player set:", currentPlayer.id)
          } else {
            logger.warn("[GameControls] ⚠️ Cannot open characteristics - currentPlayer is null/undefined", {
              currentPlayerId,
              players: gameState.players.map(p => ({ id: p.id, name: p.name })),
            })
          }
        }}
        onViewMyWords={(gameState.settings as any)?.gameMode === "whoami" && currentPlayer ? () => {
          setSelectedPlayer(currentPlayer)
        } : undefined}
        onWhoamiNextWord={(gameState.settings as any)?.gameMode === "whoami" && currentPlayerId ? async () => {
          const r = await whoamiNextWord(currentPlayerId)
          if (r.error) alert(r.error)
        } : undefined}
        onStartVoting={startVoting}
        onNextRound={handleNextRound}
        onFinishGame={finishGame}
        onEndVoting={handleEndVoting}
        currentRound={gameState.currentRound}
        onOpenSpecialCards={() => setShowSpecialCards(true)}
        onOpenBunkerInfo={() => setShowBunkerInfo(true)}
        onOpenCharacteristicsManager={() => {
          logger.log("[GameControls] onOpenCharacteristicsManager clicked", {
            isHost,
            showCharacteristicsManager,
          })
          if (isHost) {
            setShowCharacteristicsManager(true)
            logger.log("[GameControls] Characteristics manager opened")
          } else {
            logger.warn("[GameControls] ⚠️ Cannot open characteristics manager - user is not host")
          }
        }}
        roundMode={gameState.settings?.roundMode || "automatic"}
        onOpenVoteCounts={
          gameState.phase === "voting" ? () => setShowVoteCountsModal(true) : undefined
        }
          />
          </div>
        </>
      )}

      {/* Voting Panel — только когда очередь модалок пуста */}
      {gameState.phase === "voting" && voteResults.length === 0 && showVotingPanel && !isSpectator && modalQueue.length === 0 && (
        <VotingPanel
          players={playersWithStream}
          currentPlayerId={currentPlayerId}
          onVote={handleVote}
          onConfirm={handleConfirmVote}
          votedPlayerId={votedPlayerId}
          cannotVoteAgainstPlayerIds={
            (currentPlayer?.metadata?.cannotVoteAgainst ?? [])
              .filter((r: { playerId?: string; player_id?: string; cardType?: string }) => {
                const cardType = (r as any).cardType
                if (cardType === "revote") return gameState.phase === "voting"
                return true
              })
              .map((r: { playerId?: string; player_id?: string }) => (r as any).playerId ?? (r as any).player_id)
              .filter((id): id is string => !!id)
          }
          onOpenSpecialCards={() => setShowSpecialCards(true)}
          timeRemaining={(() => {
            if (!gameState.roundStartedAt) return gameState.roundTimerSeconds
            const startedAt = new Date(gameState.roundStartedAt).getTime()
            const now = new Date().getTime()
            const elapsed = Math.floor((now - startedAt) / 1000)
            return Math.max(0, gameState.roundTimerSeconds - elapsed)
          })()}
          onClose={isHost && gameState.settings?.roundMode === "automatic" ? () => handleEndVoting() : () => setShowVotingPanel(false)}
          isHost={isHost}
          onTimerEnd={() => setShowVotingPanel(false)}
        />
      )}

      {/* Vote Results — только когда очередь модалок пуста */}
      {gameState.phase === "results" && voteResults.length > 0 && modalQueue.length === 0 && (
        <VoteResults
          players={playersWithStream}
          results={voteResults}
          eliminatedPlayerId={eliminatedId}
          onContinue={handleContinueAfterResults}
        />
      )}

      {/* Chat Panel */}
      <ChatPanel
        isOpen={showChat}
        onClose={() => setShowChat(false)}
        messages={chatMessages}
        onSendMessage={handleSendMessage}
        currentPlayerName={currentPlayer?.name || "Игрок"}
        sending={sendingMessage}
      />

      {/* Mystery Journal */}
      <MysteryJournal
        isOpen={showJournal}
        onClose={() => setShowJournal(false)}
        gameState={gameState}
        players={gameState.players}
      />

      {/* Sacrificial Altar */}
      <SacrificialAltar
        isOpen={showAltar}
        onClose={() => setShowAltar(false)}
        players={gameState.players}
        currentPlayerId={currentPlayerId}
        eliminatedPlayers={eliminatedPlayers}
        onViewPlayer={(player) => {
          setSelectedPlayer(player)
          setShowAltar(false)
        }}
      />

      {currentPlayerId && (
        <SpecialActionCards
          isOpen={showSpecialCards}
          onClose={() => {
            logger.log("[GamePage] Closing special cards modal")
            setShowSpecialCards(false)
          }}
          cards={specialCards}
          players={playersWithStream}
          currentPlayerId={currentPlayerId}
          currentPhase={gameState.phase}
          onUseCard={handleUseSpecialCard}
        />
      )}

      {gameState?.bunkerDescription && gameState?.bunkerInfo && (
        <BunkerInfoModal
          isOpen={showBunkerInfo}
          onClose={() => setShowBunkerInfo(false)}
          bunkerInfo={gameState.bunkerInfo}
        />
      )}

      {/* Characteristic Reveal Modal */}
      {showRevealModal && currentPlayer && (
        <CharacteristicRevealModal
          characteristics={currentPlayer.characteristics || []}
          onReveal={handleRevealCharacteristic}
          onClose={() => setShowRevealModal(false)}
        />
      )}

      {/* Очередь модалок — спецкарта и раскрытие бункера по одному */}
      {currentModal?.type === "special-card" && (
        <SpecialCardUsedModal
          isOpen={true}
          playerName={currentModal.data.playerName}
          cardName={currentModal.data.cardName}
          cardDescription={currentModal.data.cardDescription}
          cardType={currentModal.data.cardType}
          onClose={dismissCurrentModal}
        />
      )}
      {currentModal?.type === "bunker-char" && (
        <BunkerCharacteristicRevealedModal
          isOpen={true}
          characteristicName={currentModal.data.characteristicName}
          characteristicType={currentModal.data.characteristicType}
          onClose={dismissCurrentModal}
        />
      )}
      
      {/* Debug info - only when dev mode (site setting or NODE_ENV) */}
      {showDebug && showDebugInfo && (
        <div className="fixed top-20 right-4 bg-black/80 text-white text-xs p-2 rounded z-50 max-w-xs max-h-96 overflow-auto">
          <div className="font-bold mb-2">Debug Info</div>
          <div>Current Player ID: {currentPlayerId || "None"}</div>
          <div>Current Player: {currentPlayer?.name || "Not found"}</div>
          <div>Characteristics: {currentPlayer?.characteristics?.length || 0}</div>
          <div>Player ID: {currentPlayer?.id || "N/A"}</div>
          <div>Has Stream: {localStream ? "Yes" : "No"}</div>
          <div>Media Initialized: {mediaInitialized ? "Yes" : "No"}</div>
          <div>Media Error: {mediaError || "None"}</div>
          {currentPlayer?.characteristics && currentPlayer.characteristics.length > 0 && (
            <div className="mt-2">
              <div className="font-bold">Characteristics:</div>
              {currentPlayer.characteristics.map(c => (
                <div key={c.id} className="pl-2">
                  {c.category}: {c.value} ({c.isRevealed ? "revealed" : "hidden"})
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          gameState={gameState}
          isHost={isHost}
          onClose={() => setShowSettings(false)}
          onLeaveGame={handleLeaveGame}
        />
      )}

      {/* Player Detail Modal (Бункер) or Whoami Words Modal (Кто Я?) */}
      {selectedPlayer && (gameState.settings as any)?.gameMode === "whoami" ? (() => {
        const currentWord = selectedPlayer.whoamiWords?.find((w) => !w.isGuessed)
        const voteKey = currentWord ? `${selectedPlayer.id}:${currentWord.wordIndex}` : ""
        const votedIds = (gameState.whoamiVotes || {})[voteKey] || []
        const hasVoted = !!currentPlayerId && votedIds.includes(currentPlayerId)
        const votedPlayerNames = votedIds
          .map((id) => gameState.players.find((p) => p.id === id)?.name)
          .filter((n): n is string => !!n)
        return (
          <WhoamiWordsModal
            player={selectedPlayer}
            isCurrentPlayer={selectedPlayer.id === currentPlayerId}
            onClose={() => setSelectedPlayer(null)}
            onNextWord={whoamiNextWord}
            onVoteConfirm={whoamiVoteConfirm}
            nextWordByVoting={!!(gameState.settings as any)?.whoamiNextWordByVoting}
            hasVoted={hasVoted}
            votedPlayerNames={votedPlayerNames}
          />
        )
      })() : selectedPlayer ? (
        <PlayerDetailModal
          player={selectedPlayer}
          isCurrentPlayer={selectedPlayer.id === currentPlayerId}
          isHost={isHost}
          hostRole={gameState.settings?.hostRole || "host_and_player"}
          roomId={gameState.id}
          onClose={() => setSelectedPlayer(null)}
          onRevealCharacteristic={
            selectedPlayer.id === currentPlayerId
              ? (charId) => {
                  handleRevealCharacteristic(charId)
                  setSelectedPlayer(null)
                }
              : undefined
          }
        />
      ) : null}

      {/* Characteristics Manager (Host only, bunker mode only) */}
      {isHost && (gameState.settings as any)?.gameMode !== "whoami" && (
        <CharacteristicsManager
            isOpen={showCharacteristicsManager}
          onClose={() => setShowCharacteristicsManager(false)}
          players={playersWithStream}
          currentPlayerId={currentPlayerId}
          onUpdateCharacteristic={updateCharacteristic}
          onExchangeCharacteristics={exchangeCharacteristics}
          onRandomizeCharacteristic={randomizeCharacteristic}
          roomId={gameState.id}
          currentRound={gameState.currentRound}
          currentPhase={gameState.phase}
          roundMode={gameState.settings?.roundMode || "automatic"}
          onEliminatePlayer={(playerId) => handleEndVoting(playerId)}
          onKickPlayer={handleKickPlayer}
          onBanPlayer={handleBanPlayer}
          onUnbanPlayer={handleUnbanPlayer}
        />
      )}

      {/* Vote Counts Modal */}
      {gameState.phase === "voting" && (
        <VoteCountsModal
          isOpen={showVoteCountsModal}
          onClose={() => setShowVoteCountsModal(false)}
          players={playersWithStream}
          roomId={gameState.id}
          currentRound={gameState.currentRound}
          currentPlayerId={currentPlayerId || ""}
          onVote={isSpectator ? undefined : async (targetId: string) => {
            if (castVote) {
              await castVote(targetId)
              setVotedPlayerId(targetId)
              setShowVotingPanel(false)
            }
          }}
          votedPlayerId={votedPlayerId}
          isSpectator={!!isSpectator}
          cannotVoteAgainstPlayerIds={
            (currentPlayer?.metadata?.cannotVoteAgainst ?? [])
              .filter((r: { playerId?: string; player_id?: string; cardType?: string }) => {
                const cardType = (r as any).cardType
                if (cardType === "revote") return gameState.phase === "voting"
                return true
              })
              .map((r: { playerId?: string; player_id?: string }) => (r as any).playerId ?? (r as any).player_id)
              .filter((id): id is string => !!id)
          }
        />
      )}
    </div>
  )
}
