"use client"

import { useEffect, useState, useCallback, useRef } from "react"
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
import type { ChatMessage, Player } from "@/types/game"
import { Loader2 } from "lucide-react"

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

// Import constants separately (they're small and needed immediately)
import { DEFAULT_BUNKER_INFO } from "@/components/game/bunker-info"

export default function GamePage() {
  const params = useParams()
  const router = useRouter()
  // Extract roomCode immediately to avoid serialization issues with params object
  const roomCode = (params?.roomCode as string) || ""

  const {
    gameState,
    currentPlayerId,
    loading,
    isRefreshing,
    error,
    connectionState,
    reconnect,
    toggleCharacteristic,
    startVoting,
    nextRound,
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
  } = useGameState(roomCode)

  // Загрузить настройки медиа из профиля
  const { settings: mediaSettings } = useMediaSettings()

  const {
    localStream,
    remoteStreams,
    audioEnabled,
    videoEnabled,
    error: mediaError,
    initializeMedia,
    toggleAudio,
    toggleVideo,
  } = useWebRTC({
    roomId: gameState?.id || "",
    userId: currentPlayerId || "",
    currentPlayerId: currentPlayerId || "",
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
  const [specialCards, setSpecialCards] = useState<any[]>([])
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [votedPlayerId, setVotedPlayerId] = useState<string | undefined>()
  const [voteResults, setVoteResults] = useState<{ playerId: string; votes: number }[]>([])
  const [eliminatedId, setEliminatedId] = useState<string | undefined>()
  const [showVotingPanel, setShowVotingPanel] = useState(true)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [showDebugInfo, setShowDebugInfo] = useState(false) // Hidden by default
  const [showRefreshIndicator, setShowRefreshIndicator] = useState(false) // Hidden by default

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

  // Reset voting panel state when entering voting phase
  useEffect(() => {
    if (gameState.phase === "voting") {
      setShowVotingPanel(true)
    } else {
      setShowVotingPanel(false)
    }
  }, [gameState.phase])

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
            console.log("[Vote] Found existing vote:", votes[0].target_id)
          } else {
            setVotedPlayerId(undefined)
            console.log("[Vote] No existing vote found for current player")
          }
        } catch (err) {
          console.error("Error checking vote:", err)
        }
      }
      checkVote()
    } else if (gameState.phase !== "voting") {
      // Clear voted player ID when not in voting phase
      setVotedPlayerId(undefined)
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
          console.debug("[Heartbeat] Failed to send heartbeat:", err)
        })
      } catch (err) {
        console.debug("[Heartbeat] Error sending heartbeat:", err)
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
  useEffect(() => {
    if (!gameState.id || (gameState.phase !== "playing" && gameState.phase !== "voting")) {
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
            console.log("[Timer] Phase changed, refreshing game state")
            timerExpiredRef.current = false // Reset expired flag on phase change
            refresh()
          } else if (data.expired && phase === "voting") {
            // Timer expired in voting phase - refresh state only once
            if (!timerExpiredRef.current) {
              console.log("[Timer] Voting timer expired, refreshing state once")
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
    // Запрашиваем доступ только когда игра загружена и комната существует, и еще не инициализировали
    // Также проверяем настройки пользователя - должен ли автоматически запрашивать доступ
    if (
      !loading &&
      gameState.id &&
      currentPlayerId &&
      !mediaInitialized &&
      (mediaSettings.autoRequestCamera || mediaSettings.autoRequestMicrophone)
    ) {
      console.log("[Media] Conditions met - requesting camera/microphone access...", {
        loading,
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
            console.log("[Media] Successfully initialized media stream:", {
              streamId: stream.id,
              videoTracks: stream.getVideoTracks().length,
              audioTracks: stream.getAudioTracks().length,
            })
            
            // Применить настройки по умолчанию (включить/выключить треки)
            // Состояние обновится автоматически в хуке useWebRTC через useEffect
            const videoTracks = stream.getVideoTracks()
            videoTracks.forEach((track) => {
              track.enabled = mediaSettings.defaultCameraEnabled
              console.log(`[Media] Video track ${track.id} enabled: ${track.enabled}`)
            })
            
            const audioTracks = stream.getAudioTracks()
            audioTracks.forEach((track) => {
              track.enabled = mediaSettings.defaultMicrophoneEnabled
              console.log(`[Media] Audio track ${track.id} enabled: ${track.enabled}`)
            })
            
            // Проверить, что localStream обновился в useWebRTC
            setTimeout(() => {
              console.log("[Media] Checking localStream after initialization:", {
                hasLocalStream: !!localStream,
                localStreamId: localStream?.id,
                videoEnabled,
                audioEnabled,
              })
            }, 100)
            
            setMediaInitialized(true)
          } else {
            // Stream is null (likely permission denied) - this is OK, user can enable manually
            console.log("[Media] Media initialization returned null (likely permission denied) - user can enable manually")
            // Set initialized to true so we don't keep retrying automatically
            setMediaInitialized(true)
          }
        })
        .catch((err) => {
          // Check if it's a permission error
          const isPermissionError = 
            (err instanceof DOMException && err.name === "NotAllowedError") ||
            (err instanceof Error && (err.name === "NotAllowedError" || err.message.includes("Permission denied")))
          
          if (isPermissionError) {
            console.log("[Media] Permission denied - user can enable media manually via button")
            // Set initialized to true so we don't keep retrying
            setMediaInitialized(true)
          } else {
            console.warn("[Media] Failed to initialize media (non-permission error):", err)
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
      console.log("[Media] Auto-request disabled by user settings")
      setMediaInitialized(true)
    }
  }, [loading, gameState.id, currentPlayerId, initializeMedia, mediaInitialized, mediaSettings])

  // Update players with their streams (local and remote)
  // Log current state for debugging
  console.log("[GamePage] Creating playersWithStream:", {
    playersCount: gameState.players.length,
    currentPlayerId,
    hasLocalStream: !!localStream,
    localStreamId: localStream?.id,
    videoEnabled,
    audioEnabled,
    remoteStreamsCount: remoteStreams?.size || 0,
  })

  const playersWithStream = gameState.players.map((player) => {
    if (player.id === currentPlayerId) {
      // Текущий игрок - всегда используем локальный поток если он есть
      if (localStream) {
        console.log(`[GamePage] Mapping local stream for current player ${player.name} (${player.id}):`, {
          hasStream: true,
          videoEnabled,
          audioEnabled,
          videoTracks: localStream.getVideoTracks().length,
          audioTracks: localStream.getAudioTracks().length,
          streamId: localStream.id,
        })
        return { ...player, stream: localStream, audioEnabled, videoEnabled }
      } else {
        // Текущий игрок без локального потока
        console.log(`[GamePage] Current player ${player.name} (${player.id}) has no local stream - user needs to enable camera/microphone`)
        return { ...player, stream: undefined, audioEnabled: false, videoEnabled: false }
      }
    } else if (remoteStreams && remoteStreams.has(player.id)) {
      // Удаленный поток другого игрока
      const remoteStream = remoteStreams.get(player.id)!
      const videoEnabled = remoteStream.getVideoTracks().some((t) => t.enabled && t.readyState === "live")
      const audioEnabled = remoteStream.getAudioTracks().some((t) => t.enabled && t.readyState === "live")
      console.log(`[GamePage] ✅ Mapping REMOTE stream for player ${player.name} (${player.id}):`, {
        hasStream: true,
        videoEnabled,
        audioEnabled,
        videoTracks: remoteStream.getVideoTracks().length,
        audioTracks: remoteStream.getAudioTracks().length,
        streamId: remoteStream.id,
      })
      return {
        ...player,
        stream: remoteStream,
        videoEnabled,
        audioEnabled,
      }
    } else {
      // Log when player doesn't have a stream
      if (player.id !== currentPlayerId) {
        console.warn(`[GamePage] ⚠️ No stream for player ${player.name} (${player.id}), remoteStreams has keys:`, Array.from(remoteStreams?.keys() || []))
      }
    }
    return player
  })

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
  const eliminatedPlayers = gameState.players.filter((p) => p.isEliminated)
  const survivors = gameState.players.filter((p) => !p.isEliminated)

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
      console.log("[Vote] Vote cast successfully for player:", voteTargetId)
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
  const handleEndVoting = useCallback(async () => {
    if (!gameState.id) return

    try {
      const response = await fetch("/api/game/eliminate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: gameState.id }),
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
  }, [gameState.id, refresh])

  // Handle continue after results
  const handleContinueAfterResults = useCallback(() => {
    setVoteResults([])
    setEliminatedId(undefined)
    setVotedPlayerId(undefined)
    nextRound()
  }, [nextRound])

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
          console.log("[Leave] Room closed because host left")
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
    // System message will be added via API
    refresh()
  }, [startGame, refresh])

  // Load special cards when game state changes
  useEffect(() => {
    if (gameState?.phase !== "waiting" && currentPlayerId && useSpecialCard) {
      // Fetch special cards from API
      const loadCards = async () => {
        try {
          const response = await fetch(
            `/api/game/special-cards?playerId=${currentPlayerId}&roomId=${gameState.id}`
          )
          if (response.ok) {
            const data = await response.json()
            // Transform database cards to component format
            const transformedCards = (data.cards || []).map((card: any) => ({
              id: card.id,
              name: getCardName(card.card_type),
              description: getCardDescription(card.card_type),
              type: card.card_type,
              isUsed: card.is_used,
            }))
            setSpecialCards(transformedCards)
          }
        } catch (err) {
          console.error("Error loading special cards:", err)
        }
      }
      loadCards()
    }
  }, [gameState?.phase, gameState?.id, currentPlayerId])

  // Handle Shift+U to toggle debug info and refresh indicator
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      const target = event.target as HTMLElement
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return
      }

      // Check for Shift+U (case insensitive)
      if (event.shiftKey && (event.key === "U" || event.key === "u" || event.key.toLowerCase() === "u")) {
        event.preventDefault()
        event.stopPropagation()
        setShowDebugInfo((prev) => {
          const newValue = !prev
          console.debug("[Debug] Toggling debug info:", newValue)
          return newValue
        })
        setShowRefreshIndicator((prev) => {
          const newValue = !prev
          console.debug("[Debug] Toggling refresh indicator:", newValue)
          return newValue
        })
      }
    }

    window.addEventListener("keydown", handleKeyDown, true) // Use capture phase
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true)
    }
  }, [])

  const getCardDescription = (type: string) => {
    const descriptions: Record<string, string> = {
      exchange: "Обменяйте одну из своих характеристик с другим игроком",
      peek: "Посмотрите одну скрытую характеристику другого игрока",
      immunity: "Защитите себя от изгнания на этом раунде",
      reroll: "Перегенерируйте одну из своих характеристик",
      reveal: "Раскройте одну характеристику другого игрока для всех",
      steal: "Украдите одну характеристику у другого игрока",
      "discard-health": "Сбросьте открытую карту здоровья у любого игрока",
      "double-vote": "Ваш голос считается за два в этом голосовании",
      "no-vote-against": "Выбранный игрок до конца игры не голосует против вас",
      reshuffle: "Соберите все открытые карты определенной категории, перемешайте и перераздайте",
      revote: "Все должны переголосовать заново, выбирая другого кандидата",
      "replace-profession": "Замените открытую карту профессии любого игрока на случайную из колоды",
      "replace-health": "Замените открытую карту здоровья любого игрока на случайную из колоды",
    }
    return descriptions[type] || ""
  }

  const getCardName = (type: string) => {
    const names: Record<string, string> = {
      exchange: "Обмен характеристикой",
      peek: "Подглядывание",
      immunity: "Иммунитет",
      reroll: "Перебросить",
      reveal: "Раскрыть карту",
      steal: "Украсть характеристику",
      "discard-health": "Хорошие таблетки",
      "double-vote": "Громкий голос",
      "no-vote-against": "Будь другом",
      reshuffle: "Давайте начистоту",
      revote: "План Б",
      "replace-profession": "Фейковый диплом",
      "replace-health": "Просроченные таблетки",
    }
    return names[type] || type
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

        // Add system message
        const systemMessage: ChatMessage = {
          id: Math.random().toString(36).substring(7),
          message: `${currentPlayer?.name} использовал карту: ${card.name}`,
          type: "system",
          timestamp: new Date(),
        }
        setChatMessages((prev) => [...prev, systemMessage])
      } catch (err) {
        console.error("Error using special card:", err)
        // Error is already handled in useSpecialCard
      }
    },
    [gameState, currentPlayerId, specialCards, useSpecialCard, currentPlayer?.name],
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
      console.log("[GamePage] Room was deleted, redirecting to lobby")
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
      // Wait a bit for auth to restore, then show error
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center max-w-md">
            <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Проверка авторизации...</p>
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
    <div className="min-h-screen bg-background flex flex-col relative">
      {/* Subtle refresh indicator in top-right corner (hidden by default, toggle with Shift+U) */}
      {isRefreshing && showRefreshIndicator && (
        <div className="fixed top-4 right-4 z-50 bg-background/80 backdrop-blur-sm border rounded-lg px-3 py-2 shadow-lg flex items-center gap-2">
          <Loader2 className="h-4 w-4 text-primary animate-spin" />
          <span className="text-sm text-muted-foreground">Обновление...</span>
        </div>
      )}
      {/* Connection Status */}
      <ConnectionStatus
        isConnected={connectionState === "connected"}
        isReconnecting={connectionState === "reconnecting"}
        onRetry={reconnect}
      />
      <OnlineStatus />

      {/* Media error banner */}
      {mediaError && !localStream && (
        <div className="bg-destructive/20 border-b border-destructive/50 px-4 py-2 text-sm text-destructive">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <span>{mediaError}</span>
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
          </div>
        </div>
      )}

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
        unreadMessagesCount={unreadMessagesCount}
        onOpenSettings={() => setShowSettings(true)}
        onOpenJournal={() => setShowJournal(true)}
        onOpenAltar={() => setShowAltar(true)}
        onTimerEnd={() => {
          // Автоматически начать голосование когда таймер истекает
          // Проверяем, что игра еще в фазе playing (может быть уже автоматически перешла через сервер)
          if (gameState.phase === "playing" && isHost) {
            startVoting().catch((err) => {
              // Если произошла ошибка (например, игра уже в voting), просто обновим состояние
              console.log("[Timer] Error starting voting from timer:", err)
              refresh()
            })
          }
        }}
      />

      <CatastropheBanner catastrophe={gameState.catastrophe} bunkerDescription={gameState.bunkerDescription} />

      <main className="flex-1 pb-20">
        <PlayerGrid
          players={playersWithStream}
          maxPlayers={gameState.maxPlayers}
          currentPlayerId={currentPlayerId}
          onToggleCharacteristic={toggleCharacteristic}
          onSelectPlayer={setSelectedPlayer}
          mutedPlayers={mutedPlayers}
          onTogglePlayerMute={togglePlayerMute}
        />
      </main>

      <GameControls
        isHost={isHost}
        currentPhase={gameState.phase}
        allPlayersMuted={allPlayersMuted}
        onToggleAllPlayersMute={toggleAllPlayersMute}
        audioEnabled={audioEnabled}
        videoEnabled={videoEnabled}
        hasLocalStream={!!localStream}
        onToggleMic={toggleAudio}
        onToggleVideo={toggleVideo}
        onRequestMedia={() => {
          console.log("[Media] Manual media request triggered")
          setMediaInitialized(false) // Сбрасываем флаг, чтобы можно было повторить
          initializeMedia({
            video: true,
            audio: true,
          })
            .then((stream) => {
              if (stream) {
                console.log("[Media] Manual media request successful, stream:", stream.id)
                console.log("[Media] Successfully initialized media stream (manual)")
                setMediaInitialized(true)
              }
            })
            .catch((err) => {
              console.error("[Media] Failed to initialize media:", err)
              // Оставляем возможность повторить
            })
        }}
        onRevealCharacteristic={() => setShowRevealModal(true)}
        onViewMyCharacteristics={() => {
          if (currentPlayer) {
            setSelectedPlayer(currentPlayer)
          }
        }}
        onStartVoting={startVoting}
        onNextRound={nextRound}
        onEndVoting={handleEndVoting}
        onOpenSpecialCards={() => setShowSpecialCards(true)}
        onOpenBunkerInfo={() => setShowBunkerInfo(true)}
        onOpenCharacteristicsManager={() => setShowCharacteristicsManager(true)}
      />

      {/* Voting Panel */}
      {gameState.phase === "voting" && voteResults.length === 0 && showVotingPanel && (
        <VotingPanel
          players={playersWithStream}
          currentPlayerId={currentPlayerId}
          onVote={handleVote}
          onConfirm={handleConfirmVote}
          votedPlayerId={votedPlayerId}
          timeRemaining={(() => {
            if (!gameState.roundStartedAt) return gameState.roundTimerSeconds
            const startedAt = new Date(gameState.roundStartedAt).getTime()
            const now = new Date().getTime()
            const elapsed = Math.floor((now - startedAt) / 1000)
            return Math.max(0, gameState.roundTimerSeconds - elapsed)
          })()}
          onClose={isHost ? handleEndVoting : () => setShowVotingPanel(false)}
          isHost={isHost}
          onTimerEnd={() => setShowVotingPanel(false)}
        />
      )}

      {/* Vote Results */}
      {gameState.phase === "results" && voteResults.length > 0 && (
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
          onClose={() => setShowSpecialCards(false)}
          cards={specialCards}
          players={playersWithStream}
          currentPlayerId={currentPlayerId}
          onUseCard={handleUseSpecialCard}
        />
      )}

      <BunkerInfoModal
        isOpen={showBunkerInfo}
        onClose={() => setShowBunkerInfo(false)}
        bunkerInfo={DEFAULT_BUNKER_INFO}
      />

      {/* Characteristic Reveal Modal */}
      {showRevealModal && currentPlayer && (
        <CharacteristicRevealModal
          characteristics={currentPlayer.characteristics || []}
          onReveal={handleRevealCharacteristic}
          onClose={() => setShowRevealModal(false)}
        />
      )}
      
      {/* Debug info - remove in production */}
      {process.env.NODE_ENV === "development" && showDebugInfo && (
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

      {/* Player Detail Modal */}
      {selectedPlayer && (
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
      )}

      {/* Characteristics Manager (Host only) */}
      {isHost && (
        <CharacteristicsManager
          isOpen={showCharacteristicsManager}
          onClose={() => setShowCharacteristicsManager(false)}
          players={playersWithStream}
          currentPlayerId={currentPlayerId}
          onUpdateCharacteristic={updateCharacteristic}
          onExchangeCharacteristics={exchangeCharacteristics}
          onRandomizeCharacteristic={randomizeCharacteristic}
        />
      )}
    </div>
  )
}
