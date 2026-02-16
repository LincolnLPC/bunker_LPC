"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRealtimeGame } from "@/hooks/use-realtime-game"
import { retry, isRetryableError } from "@/lib/error-handling/connection-recovery"
import { joinResponseSchema, startResponseSchema, voteResponseSchema } from "@/lib/api/schemas"
import type { GameState, Player, Characteristic, Vote, ChatMessage, Spectator } from "@/types/game"
import { logger } from "@/lib/logger"
import { useDebouncedCallback } from "@/hooks/use-debounced-callback"
import type { CameraEffectPayload } from "@/hooks/use-realtime-game"

// Transform database row to GameState
function transformRoomToGameState(room: any, currentUserId: string): { state: GameState; currentPlayerId: string; currentSpectatorId: string } {
  let foundPlayerId = ""
  const currentSpectator = (room.game_spectators || []).find((s: any) => s.user_id === currentUserId)
  const foundSpectatorId = currentSpectator?.id || ""
  const isHost = room.host_id === currentUserId
  const hostRole = (room.settings as any)?.hostRole || "host_and_player"
  
  // Filter out host if they are in "host_only" mode
  const players: Player[] = (room.game_players || [])
    .filter((p: any) => {
      // If host is in "host_only" mode, don't show them in player list
      if (hostRole === "host_only" && p.user_id === room.host_id) {
        return false
      }
      return true
    })
    .map((p: any) => {
      // Check if this is the current user's player
      if (p.user_id === currentUserId) {
        foundPlayerId = p.id
      }
      
      const characteristics = (p.player_characteristics || [])
        .map((c: any) => ({
          id: c.id,
          name: c.name,
          value: c.value,
          isRevealed: c.is_revealed || false,
          category: c.category,
          sortOrder: c.sort_order || 0,
        }))
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
      
      // Log characteristics for debugging
      if (p.user_id === currentUserId && characteristics.length === 0 && p.player_characteristics) {
        logger.warn("[GameState] transformRoomToGameState: Current player has empty characteristics array:", {
          playerId: p.id,
          playerName: p.name,
          rawCharacteristics: p.player_characteristics,
          characteristicsLength: p.player_characteristics?.length || 0
        })
      }
      
      let metadata: { cannotVoteAgainst?: Array<{ playerId?: string; player_id?: string; cardType?: string }> } | undefined
      try {
        const raw = p.metadata
        if (raw != null && (typeof raw === "object" || typeof raw === "string")) {
          const parsed = typeof raw === "string" ? JSON.parse(raw) : raw
          if (parsed && Array.isArray(parsed.cannotVoteAgainst)) {
            metadata = { cannotVoteAgainst: parsed.cannotVoteAgainst }
          }
        }
      } catch {
        // ignore parse errors
      }
      const whoamiWords = (p.player_whoami_words || [])
        .map((w: any) => ({
          id: w.id,
          word: w.word,
          wordIndex: w.word_index,
          isGuessed: w.is_guessed || false,
        }))
        .sort((a: { wordIndex: number }, b: { wordIndex: number }) => a.wordIndex - b.wordIndex)

      return {
        id: p.id,
        userId: p.user_id, // Add user_id for reporting
        slot: p.slot,
        name: p.name,
        gender: p.gender,
        genderModifier: p.gender_modifier || "",
        age: p.age,
        profession: p.profession,
        characteristics,
        isEliminated: p.is_eliminated || false,
        isHost: p.is_host || false,
        isReady: p.is_ready ?? false,
        videoEnabled: p.video_enabled ?? true,
        audioEnabled: p.audio_enabled ?? true,
        metadata,
        whoamiWords: whoamiWords.length > 0 ? whoamiWords : undefined,
      }
    })
    .sort((a, b) => a.slot - b.slot) // Фиксируем порядок игроков по slot

  // Use bunker_info from database if available
  // For backward compatibility: old rooms without bunker_info will not show detailed info
  const bunkerInfo = room.bunker_info || undefined

  // Transform spectators
  const spectators: Spectator[] = (room.game_spectators || []).map((s: any) => ({
    id: s.id,
    userId: s.user_id,
    userName: s.profiles?.display_name || s.profiles?.username || "Неизвестно",
    joinedAt: s.joined_at,
  }))

  const state: GameState = {
    id: room.id,
    roomCode: room.room_code,
    phase: room.phase || "waiting",
    currentRound: room.current_round || 0,
    maxPlayers: room.max_players || 12,
    catastrophe: room.catastrophe || "",
    bunkerDescription: room.bunker_description || "",
    bunkerInfo: bunkerInfo,
    players,
    spectators,
    hostId: room.host_id || "",
    votes: [], // Votes will be loaded separately if needed
    chatMessages: [], // Chat messages will be loaded separately
    roundTimerSeconds: room.round_timer_seconds || 120,
    roundStartedAt: room.round_started_at || undefined,
    createdAt: room.created_at || new Date().toISOString(),
    settings: room.settings || {},
    whoamiVotes: (room as any).whoamiVotes || undefined,
  }

  return { state, currentPlayerId: foundPlayerId, currentSpectatorId: foundSpectatorId }
}

export interface UseGameStateOptions {
  onCameraEffect?: (payload: CameraEffectPayload) => void
}

export function useGameState(roomCode: string, options?: UseGameStateOptions) {
  const supabase = createClient()
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [currentPlayerId, setCurrentPlayerId] = useState<string>("")
  const [currentSpectatorId, setCurrentSpectatorId] = useState<string>("")
  const [loading, setLoading] = useState(true) // Only true on initial load
  const [isRefreshing, setIsRefreshing] = useState(false) // For background updates
  const [error, setError] = useState<string | null>(null)
  const loadingRef = useRef(false)
  const loadGameStateTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastLoadTimeRef = useRef<number>(0)
  const isInitialLoadRef = useRef(true) // Track if this is the first load

  // Load initial game state
  const loadGameState = useCallback(async () => {
    // Debounce: don't load more than once per 2 seconds
    const now = Date.now()
    if (now - lastLoadTimeRef.current < 2000) {
      // Clear existing timeout and set a new one
      if (loadGameStateTimeoutRef.current) {
        clearTimeout(loadGameStateTimeoutRef.current)
      }
      loadGameStateTimeoutRef.current = setTimeout(() => {
        loadGameState()
      }, 2000 - (now - lastLoadTimeRef.current))
      return
    }
    
    if (loadingRef.current) return
    loadingRef.current = true
    lastLoadTimeRef.current = now
    
    // Only show full loading screen on initial load
    const isInitialLoad = isInitialLoadRef.current
    if (isInitialLoad) {
      setLoading(true)
    } else {
      setIsRefreshing(true) // Background refresh indicator
    }
    setError(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setError("Not authenticated")
        isInitialLoadRef.current = false
        setLoading(false)
        setIsRefreshing(false)
        loadingRef.current = false
        return
      }

      // Fetch room data with user_id in game_players and spectators
      // player_whoami_words — отдельным запросом, т.к. таблица может отсутствовать или схема не обновлена
      let { data: room, error: roomError } = await supabase
        .from("game_rooms")
        .select(
          `
          *,
          game_players (
            *,
            player_characteristics (*)
          ),
          game_spectators (
            id,
            user_id,
            joined_at,
            profiles:user_id (username, display_name)
          )
        `,
        )
        .eq("room_code", roomCode)
        .single()

      const attachWhoamiWords = async (r: any) => {
        if (!r?.game_players?.length) return
        try {
          const playerIds = r.game_players.map((p: any) => p.id)
          const { data: whoamiWords } = await supabase
            .from("player_whoami_words")
            .select("*")
            .in("player_id", playerIds)
          if (whoamiWords?.length) {
            for (const p of r.game_players) {
              (p as any).player_whoami_words = whoamiWords.filter((w: any) => w.player_id === p.id)
            }
          }
        } catch {
          // Таблица player_whoami_words может отсутствовать — игнорируем
        }
      }
      const attachWhoamiVotes = async (r: any) => {
        if ((r?.settings as any)?.gameMode !== "whoami" || !r?.id) return
        try {
          const { data: votes } = await supabase
            .from("whoami_word_votes")
            .select("target_player_id, word_index, voter_player_id")
            .eq("room_id", r.id)
          if (votes?.length) {
            const map: Record<string, string[]> = {}
            for (const v of votes) {
              const key = `${v.target_player_id}:${v.word_index}`
              if (!map[key]) map[key] = []
              map[key].push(v.voter_player_id)
            }
            (r as any).whoamiVotes = map
          }
        } catch {
          // Игнорируем
        }
      }
      await attachWhoamiWords(room)
      await attachWhoamiVotes(room)

      // Handle case when room is deleted (PGRST116 = "Cannot coerce the result to a single JSON object")
      if (roomError) {
        // Check if room was deleted (PGRST116 error code)
        if (roomError.code === "PGRST116" || roomError.message?.includes("0 rows") || roomError.message?.includes("Cannot coerce")) {
          logger.log("[GameState] Room not found (likely deleted):", roomCode)
          setError("ROOM_DELETED") // Special error code for room deletion
          setLoading(false)
          setIsRefreshing(false)
          loadingRef.current = false
          isInitialLoadRef.current = false
          return
        }
        // Enhanced error logging (PostgrestError may have non-enumerable props)
        const code = (roomError as any)?.code
        const message = (roomError as any)?.message
        const details = (roomError as any)?.details
        const hint = (roomError as any)?.hint
        logger.error("[GameState] Error fetching room:", message ?? code ?? String(roomError), { code, message, details, hint, roomCode })
        throw roomError
      }
      if (!room) {
        logger.log("[GameState] Room not found:", roomCode)
        setError("ROOM_DELETED") // Special error code for room deletion
        setLoading(false)
        setIsRefreshing(false)
        loadingRef.current = false
        isInitialLoadRef.current = false
        return
      }

      // Log room data structure for debugging (only in development and less verbose)
      if (process.env.NODE_ENV === "development") {
        logger.debug("[GameState] Room loaded:", {
          roomId: room.id,
          roomCode: room.room_code,
          playersCount: room.game_players?.length || 0,
        })
      }

      // Check if user is already a player, if not, auto-join (especially for host/creator)
      const isPlayer = room.game_players?.some((p: any) => p.user_id === user.id)
      const isHost = room.host_id === user.id
      const hostRole = (room.settings as any)?.hostRole || "host_and_player"
      
      // Auto-join if:
      // 1. User is not a player yet
      // 2. Room is in waiting phase (for new players)
      // 3. If user is host, only join if hostRole is "host_and_player" (not "host_only")
      // OR if user is already a player, they should be able to rejoin regardless of phase
      const shouldAutoJoin = !isPlayer && room.phase === "waiting" && !(isHost && hostRole === "host_only")
      
      if (process.env.NODE_ENV === "development") {
        logger.debug("[GameState] Auto-join check:", {
          isPlayer,
          isHost,
          hostRole,
          phase: room.phase,
          shouldAutoJoin,
          canRejoin: isPlayer && room.phase !== "waiting",
        })
      }
      
      // Check if user is already a spectator
      const isSpectator = room.game_spectators?.some((s: any) => s.user_id === user.id)
      
      // If user is already a player, they should be able to rejoin regardless of phase
      // This handles page refreshes during active games
      if (isPlayer) {
        logger.log("[GameState] User is already a player, restoring game state (page refresh recovery)")
        // Player ID will be set in transformRoomToGameState below
        // No need to call join API - just continue with room data
        // Skip auto-join logic and proceed directly to transformRoomToGameState
      } else if (isSpectator) {
        // User is already a spectator - restore spectator state
        logger.log("[GameState] User is already a spectator, restoring game state")
        setCurrentPlayerId(null) // No player ID for spectators
        // Continue with room data - no need to call join API
      } else if (room.phase !== "waiting") {
        // Game has started and user is not a player or spectator - try to join as spectator
        // But first check if spectators are enabled
        const roomSettings = room.settings as any || {}
        const spectatorsEnabled = roomSettings.spectators !== false // Default to true if not set
        
        if (!spectatorsEnabled) {
          logger.log("[GameState] Spectators are disabled for this room")
          setError("Зрители отключены для этой комнаты")
          return
        }
        
        logger.log("[GameState] Game already started, attempting to join as spectator")
        try {
          const { joinResponse, responseData } = await retry(
            async () => {
              const joinResponse = await fetch("/api/game/join", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ roomCode }),
              })
              const text = await joinResponse.text()
              let responseData: any = text ? JSON.parse(text) : {}
              const parsed = joinResponseSchema.safeParse(responseData)
              if (parsed.success) responseData = parsed.data
              if (!joinResponse.ok) {
                const err = Object.assign(new Error(responseData?.error || "Join failed"), { status: joinResponse.status })
                throw err
              }
              return { joinResponse, responseData }
            },
            { maxAttempts: 3, delay: 1000, shouldRetry: isRetryableError }
          )
          if (joinResponse.ok && (responseData.isSpectator || !responseData.error)) {
            logger.log("[GameState] Successfully joined as spectator:", responseData.spectatorId)
            setCurrentPlayerId(null)
            if (responseData.spectatorId) setCurrentSpectatorId(responseData.spectatorId)
            // Reload room to get updated state with spectator
            const { data: updatedRoom } = await supabase
              .from("game_rooms")
              .select(
                `
                *,
                game_players (
                  *,
                  player_characteristics (*)
                ),
                game_spectators (
                  id,
                  user_id,
                  joined_at,
                  profiles:user_id (username, display_name)
                )
              `,
              )
              .eq("room_code", roomCode)
              .single()
            
            if (updatedRoom) {
              await attachWhoamiWords(updatedRoom)
              await attachWhoamiVotes(updatedRoom)
              room = updatedRoom
            }
          } else if (joinResponse.status === 403 && (responseData?.requiresPassword || responseData?.error?.includes("паролем"))) {
            // Room requires password - don't try to join automatically
            logger.log("[GameState] Room requires password, cannot auto-join as spectator")
            setError("Эта комната защищена паролем. Пожалуйста, введите пароль на странице присоединения.")
          } else {
            logger.error("[GameState] Failed to join as spectator:", responseData)
            logger.log("[GameState] Continuing despite spectator join failure")
          }
        } catch (spectatorError) {
          logger.error("[GameState] Error joining as spectator:", spectatorError)
          // Continue anyway - user might still be able to view
        }
      } else if (shouldAutoJoin) {
        // Auto-join if user is not yet a player and room is in waiting phase
        // This is especially important for the room creator who should automatically join
        // But skip if host chose "host_only" mode
        logger.log("[GameState] Attempting auto-join for room:", roomCode)
        try {
          await retry(
            async () => {
              try {
                const joinResponse = await fetch("/api/game/join", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ roomCode }),
                }).catch((fetchError) => {
                  // Handle fetch errors (network, abort, etc.)
                  if (fetchError instanceof Error && fetchError.name === "AbortError") {
                    logger.log("[GameState] Fetch request was aborted - this may be expected")
                    throw new Error("Request was cancelled")
                  }
                  logger.error("[GameState] Fetch error:", {
                    error: fetchError,
                    errorName: fetchError instanceof Error ? fetchError.name : typeof fetchError,
                    errorMessage: fetchError instanceof Error ? fetchError.message : String(fetchError),
                  })
                  throw fetchError
                })

              // Read response as text first (can only read once)
              const contentType = joinResponse.headers.get("content-type")
              const text = await joinResponse.text()
              
              if (!text || !text.trim()) {
                throw new Error(`Empty response from server: ${joinResponse.status} ${joinResponse.statusText}`)
              }

              // Parse JSON from text and validate shape
              let responseData: any
              try {
                responseData = JSON.parse(text)
              } catch (parseError) {
                logger.error("[GameState] Failed to parse join response:", parseError, "Response text:", text.substring(0, 200))
                throw new Error(`Invalid JSON response from server: ${joinResponse.status} ${joinResponse.statusText}`)
              }
              const joinParsed = joinResponseSchema.safeParse(responseData)
              if (joinParsed.success) responseData = joinParsed.data

              logger.log("[GameState] Join response status:", joinResponse.status, joinResponse.statusText)
              logger.log("[GameState] Join response data:", responseData)
              
              if (!joinResponse.ok) {
                const errorMessage = responseData?.error || responseData?.message || "Failed to join room"
                const errorDetails = responseData?.details || responseData?.errors || null
                
                // Handle empty error object case
                let fullErrorMessage = errorMessage
                if (errorDetails) {
                  if (typeof errorDetails === 'string') {
                    fullErrorMessage = `${errorMessage} (${errorDetails})`
                  } else if (typeof errorDetails === 'object') {
                    try {
                      fullErrorMessage = `${errorMessage} (${JSON.stringify(errorDetails)})`
                    } catch {
                      fullErrorMessage = `${errorMessage} (See console for details)`
                    }
                  }
                }
                
                // Check if room requires password - don't throw, just set error message
                if (joinResponse.status === 403 && (responseData?.requiresPassword || errorMessage.includes("паролем") || errorMessage.includes("password"))) {
                  logger.log("[GameState] Room requires password, skipping auto-join")
                  setError("Эта комната защищена паролем. Пожалуйста, введите пароль на странице присоединения.")
                  throw new Error("Room requires password")
                }
                
                // Check if error is because user is already in room - this is OK, just continue
                if (errorMessage.includes("already") || errorMessage.includes("уже") || joinResponse.status === 409) {
                  logger.log("[GameState] User already in room (expected), continuing...")
                  // Don't throw error - just continue with room reload
                } else {
                  logger.error("[GameState] Join failed:", {
                    status: joinResponse.status,
                    statusText: joinResponse.statusText,
                    error: errorMessage,
                    details: errorDetails,
                    fullResponse: responseData,
                    responseText: text?.substring(0, 500) // Log raw response text
                  })
                  throw new Error(fullErrorMessage)
                }
              }

              // Handle host-only mode FIRST (successful response but no player)
              if (responseData.hostOnly) {
                logger.log("[GameState] Host is in host-only mode, skipping player creation")
                setCurrentPlayerId(null)
                // Continue with room reload below
              } else if (responseData.isSpectator) {
                // User joined as spectator - this is OK, continue with room reload
                logger.log("[GameState] User joined as spectator:", responseData.spectatorId)
                setCurrentPlayerId(null) // No player ID for spectators
                if (responseData.spectatorId) setCurrentSpectatorId(responseData.spectatorId)
                // Continue with room reload below
              } else if (responseData.isExisting || responseData.player) {
                // User already in room OR successfully joined - update player ID
                const updatedPlayerId = responseData.player?.id
                if (updatedPlayerId) {
                  setCurrentPlayerId(updatedPlayerId)
                  logger.log("[GameState] Auto-joined successfully:", { 
                    playerId: updatedPlayerId,
                    isExisting: responseData.isExisting,
                    characteristicsCount: responseData.characteristicsCount
                  })
                } else if (responseData.isExisting) {
                  logger.log("[GameState] User already in room (expected during auto-join)")
                  // Player ID will be set after room reload
                }
                
                // Reload room to get fresh state with characteristics
                const { data: updatedRoom, error: roomReloadError } = await supabase
                  .from("game_rooms")
                  .select(
                    `
                    *,
                    game_players (
                      *,
                      player_characteristics (*)
                    ),
                    game_spectators (
                      id,
                      user_id,
                      joined_at,
                      profiles:user_id (username, display_name)
                    )
                  `,
                  )
                  .eq("room_code", roomCode)
                  .single()

                if (roomReloadError) {
                  logger.error("[GameState] Error reloading room after join:", roomReloadError)
                } else if (updatedRoom) {
                  await attachWhoamiWords(updatedRoom)
                  await attachWhoamiVotes(updatedRoom)
                  room = updatedRoom // Use updated room for further processing
                  
                  // Find player ID if not already set
                  if (!updatedPlayerId) {
                    const foundPlayer = updatedRoom.game_players?.find((p: any) => p.user_id === user.id)
                    if (foundPlayer?.id) {
                      setCurrentPlayerId(foundPlayer.id)
                      logger.log("[GameState] Found player ID after reload:", foundPlayer.id)
                    }
                  }
                  
                  const currentPlayerData = updatedRoom.game_players?.find((p: any) => p.user_id === user.id)
                  logger.log("[GameState] Room reloaded after join:", {
                    playerCount: updatedRoom.game_players?.length || 0,
                    currentPlayerInList: currentPlayerData?.id,
                    currentPlayerName: currentPlayerData?.name,
                    characteristicsCount: currentPlayerData?.player_characteristics?.length || 0,
                    characteristics: currentPlayerData?.player_characteristics?.map((c: any) => ({
                      id: c.id,
                      category: c.category,
                      name: c.name,
                      value: c.value,
                      is_revealed: c.is_revealed
                    })) || []
                  })
                  
                  // If characteristics are missing, try to fetch them directly
                  if (currentPlayerData && (!currentPlayerData.player_characteristics || currentPlayerData.player_characteristics.length === 0)) {
                    logger.warn("[GameState] No characteristics found in nested query, fetching directly...")
                    const { data: directChars, error: charsError } = await supabase
                      .from("player_characteristics")
                      .select("*")
                      .eq("player_id", currentPlayerData.id)
                      .order("sort_order", { ascending: true })
                    
                    if (charsError) {
                      logger.error("[GameState] Error fetching characteristics directly:", charsError)
                    } else {
                      logger.log("[GameState] Direct characteristics fetch result:", {
                        count: directChars?.length || 0,
                        characteristics: directChars?.map((c: any) => ({
                          id: c.id,
                          category: c.category,
                          name: c.name,
                          value: c.value
                        })) || []
                      })
                      
                      // If we found characteristics directly, add them to the room data
                      if (directChars && directChars.length > 0) {
                        const playerIndex = updatedRoom.game_players?.findIndex((p: any) => p.user_id === user.id)
                        if (playerIndex !== undefined && playerIndex >= 0 && updatedRoom.game_players) {
                          updatedRoom.game_players[playerIndex].player_characteristics = directChars
                          room = updatedRoom
                          logger.log("[GameState] Added characteristics to room data directly")
                        }
                      }
                    }
                  }
                }
              } else if (!responseData.error) {
                // No player in response and not host-only mode and no error - this might be unexpected
                logger.warn("[GameState] Join succeeded but no player returned and not host-only mode:", responseData)
              }
              
              // Force reload of game state to ensure characteristics are loaded
              logger.log("[GameState] Triggering full state reload after join")
              // We'll reload at the end of the function
              } catch (innerError) {
                // Handle errors within the retry function
                if (innerError instanceof Error && innerError.name === "AbortError") {
                  logger.log("[GameState] Request aborted during join - may be expected")
                  throw new Error("Request was cancelled")
                }
                logger.error("[GameState] Error during join attempt:", {
                  error: innerError,
                  errorName: innerError instanceof Error ? innerError.name : typeof innerError,
                  errorMessage: innerError instanceof Error ? innerError.message : String(innerError),
                })
                throw innerError
              }
            },
            {
              maxAttempts: 3,
              delay: 1000,
              shouldRetry: isRetryableError,
              onRetry: (attempt) => {
                logger.log(`[GameState] Retrying auto-join, attempt ${attempt}`)
              },
            }
          )
        } catch (joinError) {
          // Enhanced error logging
          const errorInfo = {
            error: joinError,
            errorType: typeof joinError,
            errorName: joinError instanceof Error ? joinError.name : typeof joinError,
            errorMessage: joinError instanceof Error ? joinError.message : String(joinError),
            errorCode: (joinError as any)?.code,
            isAbortError: joinError instanceof Error && joinError.name === "AbortError",
            roomCode,
          }
          
          // Check if error is because user is already in room - this is OK, not an error
          const errorMessage = joinError instanceof Error ? joinError.message.toLowerCase() : String(joinError).toLowerCase()
          if (errorMessage.includes("already") || errorMessage.includes("уже") || errorMessage.includes("existing") || errorMessage.includes("request was cancelled")) {
            logger.log("[GameState] User already in room or request cancelled (expected), continuing...", errorInfo)
          } else if (errorInfo.isAbortError) {
            logger.log("[GameState] Join request was aborted - this may be expected during navigation or retries")
            // Don't treat abort as critical error
          } else {
            logger.error("[GameState] Error auto-joining room after retries:", errorInfo)
            // Continue with existing state if join fails
            // This is not critical - user can manually join if needed
          }
        }
        
        // After auto-join attempt (successful or not), reload room data to get fresh state with characteristics
        logger.log("[GameState] Reloading room data after auto-join attempt")
        const { data: reloadedRoom, error: reloadError } = await supabase
          .from("game_rooms")
          .select(
            `
            *,
            game_players (
              *,
              player_characteristics (*)
            ),
            game_spectators (
              id,
              user_id,
              joined_at,
              profiles:user_id (username, display_name)
            )
          `,
          )
          .eq("room_code", roomCode)
          .single()

        if (!reloadError && reloadedRoom) {
          await attachWhoamiWords(reloadedRoom)
          await attachWhoamiVotes(reloadedRoom)
          // Check if characteristics are missing for current player
          const currentPlayerInReloaded = reloadedRoom.game_players?.find((p: any) => p.user_id === user.id)
          if (currentPlayerInReloaded && (!currentPlayerInReloaded.player_characteristics || currentPlayerInReloaded.player_characteristics.length === 0)) {
            logger.warn("[GameState] No characteristics found after reload, fetching directly...")
            const { data: directChars, error: charsError } = await supabase
              .from("player_characteristics")
              .select("*")
              .eq("player_id", currentPlayerInReloaded.id)
              .order("sort_order", { ascending: true })
            
            if (!charsError && directChars && directChars.length > 0) {
              logger.log("[GameState] Found characteristics via direct query:", directChars.length)
              const playerIndex = reloadedRoom.game_players?.findIndex((p: any) => p.user_id === user.id)
              if (playerIndex !== undefined && playerIndex >= 0 && reloadedRoom.game_players) {
                reloadedRoom.game_players[playerIndex].player_characteristics = directChars
                logger.log("[GameState] Added characteristics to room data after reload")
              }
            } else if (charsError) {
              logger.error("[GameState] Error fetching characteristics directly after reload:", charsError)
            } else {
              logger.warn("[GameState] No characteristics found in database for player:", currentPlayerInReloaded.id)
            }
          }
          
          room = reloadedRoom
          const currentPlayerInReload = reloadedRoom.game_players?.find((p: any) => p.user_id === user.id)
          logger.log("[GameState] Room reloaded after auto-join:", {
            playerCount: reloadedRoom.game_players?.length || 0,
            currentPlayerFound: !!currentPlayerInReload,
            currentPlayerId: currentPlayerInReload?.id,
            characteristicsCount: currentPlayerInReload?.player_characteristics?.length || 0,
            characteristics: currentPlayerInReload?.player_characteristics?.map((c: any) => ({ 
              category: c.category, 
              value: c.value, 
              isRevealed: c.is_revealed 
            }))
          })
        } else if (reloadError) {
          logger.error("[GameState] Error reloading room after auto-join:", reloadError)
        }
      }

      // Transform to GameState and get current player / spectator ID
      const { state, currentPlayerId: foundPlayerId, currentSpectatorId: foundSpectatorId } = transformRoomToGameState(room, user.id)
      
      // Find current player
      const currentPlayer = state.players.find(p => p.id === foundPlayerId)
      
      setCurrentSpectatorId(foundSpectatorId || "")
      
      // Log characteristics for current player for debugging (only in development)
      if (process.env.NODE_ENV === "development") {
        logger.debug("[GameState] Transformed state:", {
          currentPlayerId: foundPlayerId,
          currentPlayerName: currentPlayer?.name,
          playersCount: state.players.length,
          isPlayer: !!currentPlayer,
          allPlayerIds: state.players.map(p => p.id),
        })
      }
      
      // If player not found, check if they're in the room but filtered out (e.g., host_only mode)
      if (!foundPlayerId || !currentPlayer) {
        const playerByUserId = room.game_players?.find((p: any) => p.user_id === user.id)
        if (playerByUserId) {
          // Player exists in room but wasn't found in transformed state
          // This can happen if host is in "host_only" mode and was filtered out
          const isHostOnly = (room.settings as any)?.hostRole === "host_only" && room.host_id === user.id
          if (isHostOnly) {
            logger.log("[GameState] Host is in host_only mode, not setting player ID")
            setGameState((prev) => ({ ...state, chatMessages: prev?.chatMessages ?? [] }))
            setCurrentPlayerId("") // Empty for host_only mode
          } else {
            // Player should be in state but isn't - use their ID anyway
            logger.log("[GameState] Player found in room but not in transformed state, using room player ID:", playerByUserId.id)
            setGameState((prev) => ({ ...state, chatMessages: prev?.chatMessages ?? [] }))
            setCurrentPlayerId(playerByUserId.id)
          }
        } else {
          // Player truly not in room - this is OK if they're trying to join
          logger.log("[GameState] Player not found in room - may need to join")
          setGameState((prev) => ({ ...state, chatMessages: prev?.chatMessages ?? [] }))
          setCurrentPlayerId(foundPlayerId || "")
        }
      } else {
        // Player found normally
        if (!currentPlayer.characteristics || currentPlayer.characteristics.length === 0) {
          logger.warn("[GameState] WARNING: Current player has no characteristics!", {
            currentPlayerId: foundPlayerId,
            currentPlayer: currentPlayer,
            allPlayers: state.players.map(p => ({ id: p.id, name: p.name, characteristicsCount: p.characteristics?.length || 0 }))
          })
        }
        
        setGameState((prev) => ({ ...state, chatMessages: isInitialLoad ? [] : (prev?.chatMessages ?? []) }))
        setCurrentPlayerId(foundPlayerId)
      }

      // Load chat messages only on initial load - use realtime subscription for updates to avoid overwriting and blinking
      if (isInitialLoad) {
        const { data: messages, error: messagesError } = await supabase
          .from("chat_messages")
          .select(
            `
            *,
            game_players (name)
          `,
          )
          .eq("room_id", room.id)
          .order("created_at", { ascending: true })

        let chatMessages: ChatMessage[] = []
        if (!messagesError && messages) {
          chatMessages = messages.map((m: any) => ({
            id: m.id,
            playerId: m.player_id || undefined,
            playerName: m.game_players?.name || undefined,
            message: m.message,
            type: (m.message_type || "chat") as ChatMessage["type"],
            timestamp: new Date(m.created_at),
          }))
        }

        setGameState((prev) => (prev ? { ...prev, chatMessages } : null))
      }
      // Mark initial load as complete
      isInitialLoadRef.current = false
      setLoading(false)
      setIsRefreshing(false)
      loadingRef.current = false
    } catch (err) {
      const isAbortError = err instanceof Error && err.name === "AbortError"

      // Handle AbortError separately (request was cancelled - e.g. Strict Mode, navigation)
      if (isAbortError) {
        if (process.env.NODE_ENV === "development") {
          logger.debug("[GameState] Request aborted (navigation or retry) - ignoring")
        }
        isInitialLoadRef.current = false
        setLoading(false)
        setIsRefreshing(false)
        loadingRef.current = false
        return
      }

      // Log other errors with readable details (avoid empty {} in console)
      const errorMessage = err instanceof Error ? err.message : String(err)
      const errorCode = (err as any)?.code
      const errorDetails = (err as any)?.details
      logger.error("[GameState] Error loading game state:", errorMessage, { code: errorCode, details: errorDetails, roomCode })

      // For other errors, set error state
      setError(errorMessage)
      isInitialLoadRef.current = false
      setLoading(false)
      setIsRefreshing(false)
      loadingRef.current = false
    }
  }, [roomCode, supabase])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (loadGameStateTimeoutRef.current) {
        clearTimeout(loadGameStateTimeoutRef.current)
      }
    }
  }, [])

  // Debounced load for postgres_changes (300ms) — батчит несколько событий подряд в один запрос
  const loadGameStateDebounced = useDebouncedCallback(loadGameState, 300)

  // Initial load
  useEffect(() => {
    loadGameState()
  }, [loadGameState])

  // Set up realtime subscriptions
  const { broadcastCameraEffect } = useRealtimeGame({
    roomId: gameState?.id || "",
    onCameraEffect: options?.onCameraEffect,
    onGameStateUpdate: useCallback(
      (updates: Partial<GameState>) => {
        setGameState((prev) => (prev ? { ...prev, ...updates } : null))
        // Reload full state if major changes
        if (updates.phase || updates.currentRound) {
          loadGameStateDebounced()
        }
      },
      [loadGameStateDebounced],
    ),
    onPlayerJoin: useCallback(() => {
      loadGameStateDebounced()
    }, [loadGameStateDebounced]),
    onPlayerLeave: useCallback(() => {
      loadGameStateDebounced()
    }, [loadGameStateDebounced]),
    onChatMessage: useCallback(
      (message: ChatMessage) => {
        // Messages are now handled via postgres_changes subscription
        // This callback is kept for compatibility but shouldn't be used
        logger.log("[Realtime] Chat message via broadcast (legacy):", message)
        // Don't add message here to avoid duplicates
      },
      [],
    ),
    onVoteCast: useCallback(() => {
      // Votes are handled separately
    }, []),
    onCharacteristicReveal: useCallback(() => {
      loadGameStateDebounced()
    }, [loadGameStateDebounced]),
  })

  // Subscribe to game_rooms table changes for phase updates
  useEffect(() => {
    if (!gameState?.id) return

    const channel = supabase
      .channel(`game_rooms_changes:${gameState.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_rooms",
          filter: `id=eq.${gameState.id}`,
        },
        (payload) => {
          logger.log("[Realtime] Game room updated:", payload)
          // Reload game state when phase or other important fields change
          if (payload.new?.phase !== payload.old?.phase) {
            logger.log("[Realtime] Phase changed:", payload.old?.phase, "->", payload.new?.phase)
          }
          // Also reload when roundStartedAt changes (catastrophe intro skip)
          if (payload.new?.round_started_at !== payload.old?.round_started_at) {
            logger.log("[Realtime] Round started at changed:", payload.old?.round_started_at, "->", payload.new?.round_started_at)
          }
          loadGameStateDebounced()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [gameState?.id, supabase, loadGameStateDebounced])

  // Subscribe to game_players table changes for ready status updates and new players
  useEffect(() => {
    if (!gameState?.id) return

    const channel = supabase
      .channel(`game_players_changes:${gameState.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_players",
          filter: `room_id=eq.${gameState.id}`,
        },
        (payload) => {
          logger.log("[Realtime] Player updated:", payload)
          // Reload game state when player ready status changes
          loadGameStateDebounced()
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "game_players",
          filter: `room_id=eq.${gameState.id}`,
        },
        (payload) => {
          logger.log("[Realtime] New player joined:", payload)
          // Reload game state when new player joins
          loadGameStateDebounced()
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "game_players",
          filter: `room_id=eq.${gameState.id}`,
        },
        (payload) => {
          logger.log("[Realtime] Player left:", payload)
          // Reload game state when player leaves
          loadGameStateDebounced()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [gameState?.id, supabase, loadGameStateDebounced])

  // Subscribe to player_characteristics table changes for reveal updates
  useEffect(() => {
    if (!gameState?.id || !gameState.players || gameState.players.length === 0) return

    const playerIds = gameState.players.map(p => p.id).filter(Boolean)
    if (playerIds.length === 0) return

    const channel = supabase
      .channel(`player_characteristics_changes:${gameState.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "player_characteristics",
          filter: `player_id=in.(${playerIds.join(',')})`,
        },
        (payload) => {
          logger.log("[Realtime] Characteristic updated:", payload)
          // Reload game state when characteristics are revealed
          loadGameStateDebounced()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [gameState?.id, gameState?.players, supabase, loadGameStateDebounced])

  // Subscribe to player_whoami_words changes (Кто Я? mode)
  useEffect(() => {
    const gameMode = (gameState?.settings as any)?.gameMode
    if (!gameState?.id || gameMode !== "whoami" || !gameState.players?.length) return

    const playerIds = gameState.players.map((p) => p.id).filter(Boolean)
    if (playerIds.length === 0) return

    const channel = supabase
      .channel(`player_whoami_words_changes:${gameState.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "player_whoami_words",
          filter: `player_id=in.(${playerIds.join(",")})`,
        },
        () => loadGameStateDebounced()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [gameState?.id, gameState?.players, gameState?.settings, supabase, loadGameStateDebounced])

  // Subscribe to whoami_word_votes changes (Кто Я? mode)
  useEffect(() => {
    const gameMode = (gameState?.settings as any)?.gameMode
    if (!gameState?.id || gameMode !== "whoami") return

    const channel = supabase
      .channel(`whoami_word_votes_changes:${gameState.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "whoami_word_votes",
          filter: `room_id=eq.${gameState.id}`,
        },
        () => loadGameStateDebounced()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [gameState?.id, gameState?.settings, supabase, loadGameStateDebounced])

  // Subscribe to chat_messages table changes for realtime chat
  useEffect(() => {
    if (!gameState?.id) return

    const channel = supabase
      .channel(`chat_messages_changes:${gameState.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `room_id=eq.${gameState.id}`,
        },
        async (payload) => {
          logger.log("[Realtime] New chat message:", payload)
          
          // Fetch the new message with player name
          const { data: messageData, error } = await supabase
            .from("chat_messages")
            .select(`
              *,
              game_players (name)
            `)
            .eq("id", payload.new.id)
            .single()

          if (!error && messageData) {
            const chatMessage: ChatMessage = {
              id: messageData.id,
              playerId: messageData.player_id || undefined,
              playerName: (messageData as any).game_players?.name || undefined,
              message: messageData.message,
              type: (messageData.message_type || "chat") as ChatMessage["type"],
              timestamp: new Date(messageData.created_at),
            }
            // Add message to state - check for duplicates
            setGameState((prev) => {
              if (!prev) return null
              // Check for duplicates before adding
              if (prev.chatMessages.find(m => m.id === chatMessage.id)) {
                logger.log("[Realtime] Message already exists, skipping:", chatMessage.id)
                return prev
              }
              logger.log("[Realtime] Adding new chat message:", chatMessage.id)
              return {
                ...prev,
                chatMessages: [...prev.chatMessages, chatMessage],
              }
            })
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [gameState?.id, supabase])

  // Auto-check timer for active games
  useEffect(() => {
    if (!gameState?.id || (gameState.phase !== "playing" && gameState.phase !== "voting")) {
      return
    }

    let phaseChangedRef = { current: false } // Track if phase already changed to avoid repeated refreshes

    // Check timer every 5 seconds
    const interval = setInterval(async () => {
      try {
        const response = await fetch("/api/game/timer/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId: gameState.id }),
        })

        if (response.ok) {
          const data = await response.json()
          if (data.expired && data.phaseChanged) {
            // Only refresh once when phase changes
            if (!phaseChangedRef.current) {
              logger.log("[Timer] Phase auto-changed:", data.newPhase)
              phaseChangedRef.current = true
              // Reload game state to get updated phase
              loadGameState()
            }
          } else if (!data.phaseChanged) {
            // Phase didn't change, reset flag
            phaseChangedRef.current = false
          }
        }
      } catch (error) {
        logger.error("[Timer] Error checking timer:", error)
      }
    }, 8000) // Check every 8 seconds (reduced CPU/network load)

    return () => clearInterval(interval)
  }, [gameState?.id, gameState?.phase, loadGameState])

  // Start game
  const startGame = useCallback(async () => {
    logger.log("[GameState] 🎮 startGame() called")
    logger.log("[GameState] Current game state:", {
      roomId: gameState?.id,
      phase: gameState?.phase,
      currentRound: gameState?.currentRound,
      playersCount: gameState?.players?.length || 0,
    })
    
    // Check if game is already started before making API call
    if (gameState.phase !== "waiting") {
      logger.log("[GameState] ⚠️ Game already started, skipping start request. Current phase:", gameState.phase)
      // Just refresh the state to ensure we're in sync
      await loadGameState()
      return
    }
    if (!gameState) {
      logger.error("[GameState] ❌ Cannot start game: gameState is null")
      return
    }

    try {
      logger.log(`[GameState] 🚀 Sending start game request for room ${gameState.id}`)
      
      await retry(
        async () => {
          const response = await fetch("/api/game/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roomId: gameState.id }),
          })

          logger.log(`[GameState] 📥 Start game response: ${response.status} ${response.statusText}`)

          if (!response.ok) {
            const data = await response.json()
            const errorMessage = data.error || "Failed to start game"
            
            logger.error("[GameState] ❌ Start game failed:", {
              status: response.status,
              statusText: response.statusText,
              error: errorMessage,
              data,
            })
            
            // If game is already started, just refresh state instead of throwing error
            if (errorMessage.includes("already started") || errorMessage.includes("уже запущена") || response.status === 400) {
              logger.log("[GameState] ℹ️ Game already started, refreshing state instead of throwing error")
              await loadGameState()
              return
            }
            
            throw new Error(errorMessage)
          } else {
            const raw = await response.json().catch(() => ({}))
            const startParsed = startResponseSchema.safeParse(raw)
            const responseData = startParsed.success ? startParsed.data : raw
            logger.log("[GameState] ✅ Game started successfully, refreshing state...", responseData)
          }
        },
        {
          maxAttempts: 3,
          delay: 1000,
          shouldRetry: isRetryableError,
        }
      )

      logger.log("[GameState] 🔄 Refreshing game state after start...")
      await loadGameState()
      logger.log("[GameState] ✅ Game state refreshed after start")
    } catch (err) {
      logger.error("[GameState] ❌ Error starting game:", {
        error: err,
        errorName: err instanceof Error ? err.name : typeof err,
        errorMessage: err instanceof Error ? err.message : String(err),
      })
      setError(err instanceof Error ? err.message : "Failed to start game")
    }
  }, [gameState, loadGameState])

  // Reveal characteristic
  const revealCharacteristic = useCallback(
    async (playerId: string, characteristicId: string) => {
      if (!gameState) return

      try {
        const response = await fetch("/api/game/characteristics/reveal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomId: gameState.id,
            playerId,
            characteristicId,
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || "Failed to reveal characteristic")
        }

        loadGameState()
      } catch (err) {
        logger.error("Error revealing characteristic:", err)
        setError(err instanceof Error ? err.message : "Failed to reveal characteristic")
      }
    },
    [gameState, loadGameState],
  )

  // Toggle characteristic visibility (local only, doesn't reveal)
  const toggleCharacteristic = useCallback(
    (playerId: string, characteristicId: string) => {
      setGameState((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          players: prev.players.map((player) =>
            player.id === playerId
              ? {
                  ...player,
                  characteristics: player.characteristics.map((char) =>
                    char.id === characteristicId ? { ...char, isRevealed: !char.isRevealed } : char,
                  ),
                }
              : player,
          ),
        }
      })
    },
    [],
  )

  // Start voting phase
  const startVoting = useCallback(async () => {
    if (!gameState) return

    // Check if game is already in voting phase before making API call
    if (gameState.phase === "voting") {
      logger.log("[GameState] Game already in voting phase, skipping start voting request")
      // Just refresh the state to ensure we're in sync
      await loadGameState()
      return
    }

    // Check if game is not in playing phase
    if (gameState.phase !== "playing") {
      logger.log("[GameState] Game is not in playing phase, cannot start voting. Current phase:", gameState.phase)
      // Refresh state to get current phase
      await loadGameState()
      return
    }

    try {
      const response = await fetch("/api/game/voting/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: gameState.id }),
      })

      if (!response.ok) {
        const data = await response.json()
        const errorMessage = data.error || "Failed to start voting"
        
        // If game is already in voting phase (race condition), just refresh state
        if (errorMessage.includes("must be in playing phase") || errorMessage.includes("Game must be in playing")) {
          logger.log("[GameState] Game already transitioned to voting phase (race condition), refreshing state")
          await loadGameState()
          return
        }
        
        throw new Error(errorMessage)
      }

      loadGameState()
    } catch (err) {
      logger.error("Error starting voting:", err)
      // Don't show error if it's a phase mismatch - just refresh state
      const errorMessage = err instanceof Error ? err.message : String(err)
      if (!errorMessage.includes("must be in playing phase") && !errorMessage.includes("Game must be in playing")) {
        setError(errorMessage)
      } else {
        // Refresh state silently on phase mismatch
        loadGameState()
      }
    }
  }, [gameState, loadGameState])

  // Next round
  const nextRound = useCallback(async () => {
    if (!gameState) return

    try {
      const response = await fetch("/api/game/round/next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: gameState.id }),
      })

      if (!response.ok) {
        const data = await response.json()
        const errorMessage = data.error || "Failed to advance round"
        
        // Если ошибка связана с неправильной фазой, это может быть проблема синхронизации состояния
        // В этом случае просто обновим состояние игры, чтобы получить актуальную фазу
        if (errorMessage.includes("Must be in") && errorMessage.includes("phase")) {
          logger.warn("[GameState] Cannot advance round - wrong phase, refreshing state:", errorMessage)
          loadGameState() // Обновить состояние, чтобы получить актуальную фазу
          return
        }
        
        throw new Error(errorMessage)
      }

      loadGameState()
    } catch (err) {
      logger.error("Error advancing round:", err)
      // Не устанавливаем ошибку для ошибок фазы - это может быть проблема синхронизации
      const errorMessage = err instanceof Error ? err.message : "Failed to advance round"
      if (!errorMessage.includes("Must be in") || !errorMessage.includes("phase")) {
        setError(errorMessage)
      }
    }
  }, [gameState, loadGameState])

  // Finish game manually (host only, manual mode)
  const finishGame = useCallback(async () => {
    if (!gameState) return

    try {
      const response = await fetch("/api/game/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: gameState.id }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to finish game")
      }

      loadGameState()
    } catch (err) {
      logger.error("Error finishing game:", err)
      setError(err instanceof Error ? err.message : "Failed to finish game")
    }
  }, [gameState, loadGameState])

  // Eliminate player (end voting and eliminate)
  const eliminatePlayer = useCallback(
    async (playerId?: string) => {
      if (!gameState) return

      try {
        const response = await fetch("/api/game/eliminate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId: gameState.id, playerId }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || "Failed to eliminate player")
        }

      loadGameState()
    } catch (err) {
      logger.error("Error eliminating player:", err)
      setError(err instanceof Error ? err.message : "Failed to eliminate player")
    }
    },
    [gameState, loadGameState],
  )

  // Connection state tracking
  const [connectionState, setConnectionState] = useState<"connected" | "disconnected" | "reconnecting">("connected")
  
  // Monitor Supabase connection
  useEffect(() => {
    if (!gameState?.id) return

    const supabase = createClient()
    const channel = supabase.channel(`connection_monitor:${gameState.id}`)
    
    channel.on("system", {}, (payload) => {
      logger.log("[Connection] System event:", payload)
    })

    channel.subscribe((status) => {
      logger.log("[Connection] Channel status:", status)
      if (status === "SUBSCRIBED") {
        setConnectionState("connected")
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setConnectionState("disconnected")
        // Attempt reconnection
        setTimeout(() => {
          setConnectionState("reconnecting")
          loadGameState()
        }, 2000)
      } else if (status === "CLOSED") {
        setConnectionState("disconnected")
      }
    })

    return () => {
      channel.unsubscribe()
    }
  }, [gameState?.id, loadGameState])

  // Cast vote (with retry for network/5xx)
  const castVote = useCallback(
    async (targetId: string) => {
      if (!gameState || !currentPlayerId) {
        throw new Error("Cannot cast vote: game state or current player ID is missing")
      }

      try {
        await retry(
          async () => {
            const response = await fetch("/api/game/vote", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                roomId: gameState.id,
                targetPlayerId: targetId,
              }),
            })

            const contentType = response.headers.get("content-type")
            const text = await response.text()

            if (!text || !text.trim()) {
              const err = new Error(`Empty response from server: ${response.status} ${response.statusText}`) as Error & { status?: number }
              err.status = response.status
              throw err
            }

            let responseData: any = null
            try {
              responseData = JSON.parse(text)
            } catch (parseError) {
              logger.error("[Vote] Failed to parse JSON:", parseError, "status:", response.status, "text:", text.substring(0, 200))
              const err = new Error(`Invalid JSON response: ${response.status} ${response.statusText}`) as Error & { status?: number }
              err.status = response.status
              throw err
            }

            if (!response.ok) {
              let errorMessage: string = ""
              if (responseData?.error) {
                errorMessage = typeof responseData.error === "string" ? responseData.error : (responseData.error?.message || responseData.error?.error || String(responseData.error))
              }
              if (!errorMessage && responseData?.message) {
                errorMessage = typeof responseData.message === "string" ? responseData.message : String(responseData.message)
              }
              if (!errorMessage || errorMessage === "[object Object]") {
                errorMessage = `Server error: ${response.status} ${response.statusText}`
              }
              const voteError = new Error(errorMessage) as Error & { status?: number }
              voteError.status = response.status
              throw voteError
            }

            logger.log("[Vote] Vote cast successfully:", responseData)
          },
          { maxAttempts: 3, delay: 1000, shouldRetry: isRetryableError }
        )
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
            logger.error("[Vote] Extracting error from responseData:", responseData)
            
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
        logger.error("Error casting vote:", errorString)
        logger.error("Error casting vote (detailed):", {
          error: errorMessage,
          details: errorDetails,
          gameStateId: gameState?.id,
          currentPlayerId,
          errorType: err?.constructor?.name || typeof err,
          errorString: errorString,
          // Try to log raw error object separately
          rawError: err
        })
        
        // Also try to log error properties directly
        if (err && typeof err === "object") {
          try {
            const props = Object.getOwnPropertyNames(err)
            logger.error("Error properties:", props)
            props.forEach(prop => {
              try {
                const value = (err as any)[prop]
                logger.error(`  ${prop}:`, value)
              } catch (e) {
                logger.error(`  ${prop}: [unable to read]`)
              }
            })
          } catch (e) {
            logger.error("Could not enumerate error properties:", e)
          }
        }
        
        setError(errorMessage)
        throw err instanceof Error ? err : new Error(errorMessage) // Always throw Error object
      }
    },
    [gameState, currentPlayerId],
  )

  // Update characteristic (host only)
  const updateCharacteristic = useCallback(
    async (playerId: string, characteristicId: string, newValue: string) => {
      if (!gameState) return

      try {
        const response = await fetch("/api/game/characteristics/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomId: gameState.id,
            playerId,
            characteristicId,
            newValue,
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || "Failed to update characteristic")
        }

        loadGameState()
      } catch (err) {
        logger.error("Error updating characteristic:", err)
        setError(err instanceof Error ? err.message : "Failed to update characteristic")
        throw err
      }
    },
    [gameState, loadGameState],
  )

  // Randomize characteristic (host only)
  const randomizeCharacteristic = useCallback(
    async (playerId: string, characteristicId: string) => {
      if (!gameState) return

      try {
        const response = await fetch("/api/game/characteristics/randomize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomId: gameState.id,
            playerId,
            characteristicId,
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || "Failed to randomize characteristic")
        }

        loadGameState()
      } catch (err) {
        logger.error("Error randomizing characteristic:", err)
        setError(err instanceof Error ? err.message : "Failed to randomize characteristic")
        throw err
      }
    },
    [gameState, loadGameState],
  )

  // Exchange characteristics (host only)
  const exchangeCharacteristics = useCallback(
    async (playerId1: string, charId1: string, playerId2: string, charId2: string) => {
      if (!gameState) return

      try {
        const response = await fetch("/api/game/characteristics/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomId: gameState.id,
            playerId1,
            charId1,
            playerId2,
            charId2,
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || "Failed to exchange characteristics")
        }

        loadGameState()
      } catch (err) {
        logger.error("Error exchanging characteristics:", err)
        setError(err instanceof Error ? err.message : "Failed to exchange characteristics")
        throw err
      }
    },
    [gameState, loadGameState],
  )

  // Toggle ready status
  const toggleReady = useCallback(
    async (isReady: boolean) => {
      if (!gameState || !currentPlayerId) return

      try {
        const response = await fetch("/api/game/ready", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomId: gameState.id,
            playerId: currentPlayerId,
            isReady,
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || "Failed to update ready status")
        }

        loadGameState()
      } catch (err) {
        logger.error("Error toggling ready status:", err)
        setError(err instanceof Error ? err.message : "Failed to update ready status")
      }
    },
    [gameState, currentPlayerId, loadGameState],
  )

  // Get special cards for current player
  const getSpecialCards = useCallback(async () => {
    if (!gameState || !currentPlayerId) return []

    try {
      const response = await fetch(
        `/api/game/special-cards?playerId=${currentPlayerId}&roomId=${gameState.id}`
      )

      if (!response.ok) {
        logger.error("[GameState] Failed to fetch special cards")
        return []
      }

      const data = await response.json()
      return data.cards || []
    } catch (err) {
      logger.error("[GameState] Error fetching special cards:", err)
      return []
    }
  }, [gameState, currentPlayerId])

  // Кто Я?: следующее слово
  const whoamiNextWord = useCallback(
    async (playerId: string) => {
      if (!gameState?.id) return { error: "No game" }
      const res = await fetch("/api/game/whoami/next-word", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: gameState.id, targetPlayerId: playerId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return { error: data.error || "Failed" }
      loadGameState()
      return { success: true, ...data }
    },
    [gameState?.id, loadGameState]
  )

  // Кто Я?: подтвердить, что игрок отгадал слово (голосование)
  const whoamiVoteConfirm = useCallback(
    async (targetPlayerId: string) => {
      if (!gameState?.id) return { error: "No game" }
      const res = await fetch("/api/game/whoami/next-word", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: gameState.id,
          targetPlayerId,
          vote: true,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return { error: data.error || "Failed" }
      loadGameState()
      return { success: true }
    },
    [gameState?.id, loadGameState]
  )

  // Use special card
  const useSpecialCard = useCallback(
    async (cardId: string, cardType: string, targetPlayerId?: string, characteristicId?: string, category?: string) => {
      if (!gameState || !currentPlayerId) return

      try {
        const response = await fetch("/api/game/special-cards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playerId: currentPlayerId,
            roomId: gameState.id,
            cardId,
            cardType,
            targetPlayerId,
            characteristicId,
            category,
          }),
        })

        // Read response as text first
        const text = await response.text()
        if (!text || !text.trim()) {
          throw new Error(`Empty response from server: ${response.status}`)
        }

        let responseData: any
        try {
          responseData = JSON.parse(text)
        } catch (parseError) {
          throw new Error(`Invalid JSON response: ${response.status}`)
        }

        if (!response.ok) {
          const errorMessage = responseData?.error || "Failed to use special card"
          // Don't log expected errors for eliminated players
          if (!errorMessage.includes("Eliminated players cannot use special cards")) {
            logger.error("Error using special card:", errorMessage)
          }
          throw new Error(errorMessage)
        }

        // Reload game state to reflect changes
        loadGameState()
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to use special card"
        // Don't log expected errors for eliminated players
        if (!errorMessage.includes("Eliminated players cannot use special cards")) {
          logger.error("Error using special card:", err)
          setError(errorMessage)
        }
        throw err
      }
    },
    [gameState, currentPlayerId, loadGameState],
  )

  return {
    gameState: gameState || ({
      id: "",
      roomCode,
      phase: "waiting",
      currentRound: 0,
      maxPlayers: 12,
      catastrophe: "",
      bunkerDescription: "",
      players: [],
      hostId: "",
      votes: [],
      chatMessages: [],
      roundTimerSeconds: 120,
      createdAt: new Date().toISOString(),
    } as GameState),
    currentPlayerId,
    currentSpectatorId,
    loading,
    isRefreshing,
    error,
    connectionState,
    reconnect: loadGameState,
    toggleCharacteristic,
    revealCharacteristic,
    startVoting,
    nextRound,
    finishGame,
    eliminatePlayer,
    castVote,
    startGame,
    refresh: loadGameState,
    updateCharacteristic,
    randomizeCharacteristic,
    exchangeCharacteristics,
    toggleReady,
    getSpecialCards,
    useSpecialCard,
    broadcastCameraEffect,
    whoamiNextWord,
    whoamiVoteConfirm,
  }
}
