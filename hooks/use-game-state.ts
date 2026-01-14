"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRealtimeGame } from "@/hooks/use-realtime-game"
import { retry, isRetryableError } from "@/lib/error-handling/connection-recovery"
import type { GameState, Player, Characteristic, Vote, ChatMessage } from "@/types/game"

// Transform database row to GameState
function transformRoomToGameState(room: any, currentUserId: string): { state: GameState; currentPlayerId: string } {
  let foundPlayerId = ""
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
        console.warn("[GameState] transformRoomToGameState: Current player has empty characteristics array:", {
          playerId: p.id,
          playerName: p.name,
          rawCharacteristics: p.player_characteristics,
          characteristicsLength: p.player_characteristics?.length || 0
        })
      }
      
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
      }
    })
    .sort((a, b) => a.slot - b.slot) // Фиксируем порядок игроков по slot

  const state: GameState = {
    id: room.id,
    roomCode: room.room_code,
    phase: room.phase || "waiting",
    currentRound: room.current_round || 0,
    maxPlayers: room.max_players || 12,
    catastrophe: room.catastrophe || "",
    bunkerDescription: room.bunker_description || "",
    players,
    hostId: room.host_id || "",
    votes: [], // Votes will be loaded separately if needed
    chatMessages: [], // Chat messages will be loaded separately
    roundTimerSeconds: room.round_timer_seconds || 120,
    roundStartedAt: room.round_started_at || undefined,
    createdAt: room.created_at || new Date().toISOString(),
    settings: room.settings || {},
  }

  return { state, currentPlayerId: foundPlayerId }
}

export function useGameState(roomCode: string) {
  const supabase = createClient()
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [currentPlayerId, setCurrentPlayerId] = useState<string>("")
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

      // Fetch room data with user_id in game_players
      let { data: room, error: roomError } = await supabase
        .from("game_rooms")
        .select(
          `
          *,
          game_players (
            *,
            player_characteristics (*)
          )
        `,
        )
        .eq("room_code", roomCode)
        .single()

      // Handle case when room is deleted (PGRST116 = "Cannot coerce the result to a single JSON object")
      if (roomError) {
        // Check if room was deleted (PGRST116 error code)
        if (roomError.code === "PGRST116" || roomError.message?.includes("0 rows") || roomError.message?.includes("Cannot coerce")) {
          console.log("[GameState] Room not found (likely deleted):", roomCode)
          setError("ROOM_DELETED") // Special error code for room deletion
          setLoading(false)
          setIsRefreshing(false)
          loadingRef.current = false
          isInitialLoadRef.current = false
          return
        }
        console.error("[GameState] Error fetching room:", roomError)
        throw roomError
      }
      if (!room) {
        console.log("[GameState] Room not found:", roomCode)
        setError("ROOM_DELETED") // Special error code for room deletion
        setLoading(false)
        setIsRefreshing(false)
        loadingRef.current = false
        isInitialLoadRef.current = false
        return
      }

      // Log room data structure for debugging (only in development and less verbose)
      if (process.env.NODE_ENV === "development") {
        console.debug("[GameState] Room loaded:", {
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
        console.debug("[GameState] Auto-join check:", {
          isPlayer,
          isHost,
          hostRole,
          phase: room.phase,
          shouldAutoJoin,
          canRejoin: isPlayer && room.phase !== "waiting",
        })
      }
      
      // If user is already a player, they should be able to rejoin regardless of phase
      // This handles page refreshes during active games
      if (isPlayer) {
        console.log("[GameState] User is already a player, restoring game state (page refresh recovery)")
        // Player ID will be set in transformRoomToGameState below
        // No need to call join API - just continue with room data
        // Skip auto-join logic and proceed directly to transformRoomToGameState
      } else if (shouldAutoJoin) {
        // Auto-join if user is not yet a player and room is in waiting phase
        // This is especially important for the room creator who should automatically join
        // But skip if host chose "host_only" mode
        console.log("[GameState] Attempting auto-join for room:", roomCode)
        try {
          await retry(
            async () => {
              const joinResponse = await fetch("/api/game/join", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ roomCode }),
              })

              // Read response as text first (can only read once)
              const contentType = joinResponse.headers.get("content-type")
              const text = await joinResponse.text()
              
              if (!text || !text.trim()) {
                throw new Error(`Empty response from server: ${joinResponse.status} ${joinResponse.statusText}`)
              }

              // Parse JSON from text
              let responseData: any
              try {
                responseData = JSON.parse(text)
              } catch (parseError) {
                console.error("Failed to parse join response:", parseError, "Response text:", text.substring(0, 200))
                throw new Error(`Invalid JSON response from server: ${joinResponse.status} ${joinResponse.statusText}`)
              }

              console.log("[GameState] Join response status:", joinResponse.status, joinResponse.statusText)
              console.log("[GameState] Join response data:", responseData)
              
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
                
                // Check if error is because user is already in room - this is OK, just continue
                if (errorMessage.includes("already") || errorMessage.includes("уже") || joinResponse.status === 409) {
                  console.log("[GameState] User already in room (expected), continuing...")
                  // Don't throw error - just continue with room reload
                } else {
                  console.error("[GameState] Join failed:", {
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
                console.log("[GameState] Host is in host-only mode, skipping player creation")
                setCurrentPlayerId(null)
                // Continue with room reload below
              } else if (responseData.isExisting || responseData.player) {
                // User already in room OR successfully joined - update player ID
                const updatedPlayerId = responseData.player?.id
                if (updatedPlayerId) {
                  setCurrentPlayerId(updatedPlayerId)
                  console.log("[GameState] Auto-joined successfully:", { 
                    playerId: updatedPlayerId,
                    isExisting: responseData.isExisting,
                    characteristicsCount: responseData.characteristicsCount
                  })
                } else if (responseData.isExisting) {
                  console.log("[GameState] User already in room (expected during auto-join)")
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
                    )
                  `,
                  )
                  .eq("room_code", roomCode)
                  .single()

                if (roomReloadError) {
                  console.error("[GameState] Error reloading room after join:", roomReloadError)
                } else if (updatedRoom) {
                  room = updatedRoom // Use updated room for further processing
                  
                  // Find player ID if not already set
                  if (!updatedPlayerId) {
                    const foundPlayer = updatedRoom.game_players?.find((p: any) => p.user_id === user.id)
                    if (foundPlayer?.id) {
                      setCurrentPlayerId(foundPlayer.id)
                      console.log("[GameState] Found player ID after reload:", foundPlayer.id)
                    }
                  }
                  
                  const currentPlayerData = updatedRoom.game_players?.find((p: any) => p.user_id === user.id)
                  console.log("[GameState] Room reloaded after join:", {
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
                    console.warn("[GameState] No characteristics found in nested query, fetching directly...")
                    const { data: directChars, error: charsError } = await supabase
                      .from("player_characteristics")
                      .select("*")
                      .eq("player_id", currentPlayerData.id)
                      .order("sort_order", { ascending: true })
                    
                    if (charsError) {
                      console.error("[GameState] Error fetching characteristics directly:", charsError)
                    } else {
                      console.log("[GameState] Direct characteristics fetch result:", {
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
                          console.log("[GameState] Added characteristics to room data directly")
                        }
                      }
                    }
                  }
                }
              } else if (!responseData.error) {
                // No player in response and not host-only mode and no error - this might be unexpected
                console.warn("[GameState] Join succeeded but no player returned and not host-only mode:", responseData)
              }
              
              // Force reload of game state to ensure characteristics are loaded
              console.log("[GameState] Triggering full state reload after join")
              // We'll reload at the end of the function
            },
            {
              maxAttempts: 3,
              delay: 1000,
              shouldRetry: isRetryableError,
              onRetry: (attempt) => {
                console.log(`[GameState] Retrying auto-join, attempt ${attempt}`)
              },
            }
          )
        } catch (joinError) {
          // Check if error is because user is already in room - this is OK, not an error
          const errorMessage = joinError instanceof Error ? joinError.message.toLowerCase() : String(joinError).toLowerCase()
          if (errorMessage.includes("already") || errorMessage.includes("уже") || errorMessage.includes("existing")) {
            console.log("[GameState] User already in room (expected during auto-join), continuing...")
          } else {
            console.error("[GameState] Error auto-joining room after retries:", joinError)
            // Continue with existing state if join fails
            // This is not critical - user can manually join if needed
          }
        }
        
        // After auto-join attempt (successful or not), reload room data to get fresh state with characteristics
        console.log("[GameState] Reloading room data after auto-join attempt")
        const { data: reloadedRoom, error: reloadError } = await supabase
          .from("game_rooms")
          .select(
            `
            *,
            game_players (
              *,
              player_characteristics (*)
            )
          `,
          )
          .eq("room_code", roomCode)
          .single()

        if (!reloadError && reloadedRoom) {
          // Check if characteristics are missing for current player
          const currentPlayerInReloaded = reloadedRoom.game_players?.find((p: any) => p.user_id === user.id)
          if (currentPlayerInReloaded && (!currentPlayerInReloaded.player_characteristics || currentPlayerInReloaded.player_characteristics.length === 0)) {
            console.warn("[GameState] No characteristics found after reload, fetching directly...")
            const { data: directChars, error: charsError } = await supabase
              .from("player_characteristics")
              .select("*")
              .eq("player_id", currentPlayerInReloaded.id)
              .order("sort_order", { ascending: true })
            
            if (!charsError && directChars && directChars.length > 0) {
              console.log("[GameState] Found characteristics via direct query:", directChars.length)
              const playerIndex = reloadedRoom.game_players?.findIndex((p: any) => p.user_id === user.id)
              if (playerIndex !== undefined && playerIndex >= 0 && reloadedRoom.game_players) {
                reloadedRoom.game_players[playerIndex].player_characteristics = directChars
                console.log("[GameState] Added characteristics to room data after reload")
              }
            } else if (charsError) {
              console.error("[GameState] Error fetching characteristics directly after reload:", charsError)
            } else {
              console.warn("[GameState] No characteristics found in database for player:", currentPlayerInReloaded.id)
            }
          }
          
          room = reloadedRoom
          const currentPlayerInReload = reloadedRoom.game_players?.find((p: any) => p.user_id === user.id)
          console.log("[GameState] Room reloaded after auto-join:", {
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
          console.error("[GameState] Error reloading room after auto-join:", reloadError)
        }
      }

      // Transform to GameState and get current player ID
      const { state, currentPlayerId: foundPlayerId } = transformRoomToGameState(room, user.id)
      
      // Find current player
      const currentPlayer = state.players.find(p => p.id === foundPlayerId)
      
      // Log characteristics for current player for debugging (only in development)
      if (process.env.NODE_ENV === "development") {
        console.debug("[GameState] Transformed state:", {
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
            console.log("[GameState] Host is in host_only mode, not setting player ID")
            setGameState(state)
            setCurrentPlayerId("") // Empty for host_only mode
          } else {
            // Player should be in state but isn't - use their ID anyway
            console.log("[GameState] Player found in room but not in transformed state, using room player ID:", playerByUserId.id)
            setGameState(state)
            setCurrentPlayerId(playerByUserId.id)
          }
        } else {
          // Player truly not in room - this is OK if they're trying to join
          console.log("[GameState] Player not found in room - may need to join")
          setGameState(state)
          setCurrentPlayerId(foundPlayerId || "")
        }
      } else {
        // Player found normally
        if (!currentPlayer.characteristics || currentPlayer.characteristics.length === 0) {
          console.warn("[GameState] WARNING: Current player has no characteristics!", {
            currentPlayerId: foundPlayerId,
            currentPlayer: currentPlayer,
            allPlayers: state.players.map(p => ({ id: p.id, name: p.name, characteristicsCount: p.characteristics?.length || 0 }))
          })
        }
        
        setGameState(state)
        setCurrentPlayerId(foundPlayerId)
      }

      // Load chat messages
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

      // Update state with chat messages
      setGameState((prev) => (prev ? { ...prev, chatMessages } : null))
      // Mark initial load as complete
      isInitialLoadRef.current = false
      setLoading(false)
      setIsRefreshing(false)
      loadingRef.current = false
    } catch (err) {
      console.error("Error loading game state:", err)
      setError(err instanceof Error ? err.message : "Failed to load game state")
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

  // Initial load
  useEffect(() => {
    loadGameState()
  }, [loadGameState])

  // Set up realtime subscriptions
  useRealtimeGame({
    roomId: gameState?.id || "",
    onGameStateUpdate: useCallback(
      (updates: Partial<GameState>) => {
        setGameState((prev) => (prev ? { ...prev, ...updates } : null))
        // Reload full state if major changes
        if (updates.phase || updates.currentRound) {
          loadGameState()
        }
      },
      [loadGameState],
    ),
    onPlayerJoin: useCallback(() => {
      loadGameState()
    }, [loadGameState]),
    onPlayerLeave: useCallback(() => {
      loadGameState()
    }, [loadGameState]),
    onChatMessage: useCallback(
      (message: ChatMessage) => {
        // Messages are now handled via postgres_changes subscription
        // This callback is kept for compatibility but shouldn't be used
        console.log("[Realtime] Chat message via broadcast (legacy):", message)
        // Don't add message here to avoid duplicates
      },
      [],
    ),
    onVoteCast: useCallback(() => {
      // Votes are handled separately
    }, []),
    onCharacteristicReveal: useCallback(() => {
      loadGameState()
    }, [loadGameState]),
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
          console.log("[Realtime] Game room updated:", payload)
          // Reload game state when phase or other important fields change
          if (payload.new?.phase !== payload.old?.phase) {
            console.log("[Realtime] Phase changed:", payload.old?.phase, "->", payload.new?.phase)
          }
          loadGameState()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [gameState?.id, supabase, loadGameState])

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
          console.log("[Realtime] Player updated:", payload)
          // Reload game state when player ready status changes
          loadGameState()
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
          console.log("[Realtime] New player joined:", payload)
          // Reload game state when new player joins
          loadGameState()
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
          console.log("[Realtime] Player left:", payload)
          // Reload game state when player leaves
          loadGameState()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [gameState?.id, supabase, loadGameState])

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
          console.log("[Realtime] Characteristic updated:", payload)
          // Reload game state when characteristics are revealed
          loadGameState()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [gameState?.id, gameState?.players, supabase, loadGameState])

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
          console.log("[Realtime] New chat message:", payload)
          
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
                console.log("[Realtime] Message already exists, skipping:", chatMessage.id)
                return prev
              }
              console.log("[Realtime] Adding new chat message:", chatMessage.id)
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
              console.log("[Timer] Phase auto-changed:", data.newPhase)
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
        console.error("[Timer] Error checking timer:", error)
      }
    }, 5000) // Check every 5 seconds

    return () => clearInterval(interval)
  }, [gameState?.id, gameState?.phase, loadGameState])

  // Start game
  const startGame = useCallback(async () => {
    // Check if game is already started before making API call
    if (gameState.phase !== "waiting") {
      console.log("[GameState] Game already started, skipping start request. Current phase:", gameState.phase)
      // Just refresh the state to ensure we're in sync
      await loadGameState()
      return
    }
    if (!gameState) return

    try {
      await retry(
        async () => {
          const response = await fetch("/api/game/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roomId: gameState.id }),
          })

          if (!response.ok) {
            const data = await response.json()
            const errorMessage = data.error || "Failed to start game"
            
            // If game is already started, just refresh state instead of throwing error
            if (errorMessage.includes("already started") || errorMessage.includes("уже запущена") || response.status === 400) {
              console.log("[GameState] Game already started, refreshing state instead of throwing error")
              await loadGameState()
              return
            }
            
            throw new Error(errorMessage)
          }
        },
        {
          maxAttempts: 3,
          delay: 1000,
          shouldRetry: isRetryableError,
        }
      )

      loadGameState()
    } catch (err) {
      console.error("Error starting game:", err)
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
        console.error("Error revealing characteristic:", err)
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
      console.log("[GameState] Game already in voting phase, skipping start voting request")
      // Just refresh the state to ensure we're in sync
      await loadGameState()
      return
    }

    // Check if game is not in playing phase
    if (gameState.phase !== "playing") {
      console.log("[GameState] Game is not in playing phase, cannot start voting. Current phase:", gameState.phase)
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
          console.log("[GameState] Game already transitioned to voting phase (race condition), refreshing state")
          await loadGameState()
          return
        }
        
        throw new Error(errorMessage)
      }

      loadGameState()
    } catch (err) {
      console.error("Error starting voting:", err)
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
          console.warn("[GameState] Cannot advance round - wrong phase, refreshing state:", errorMessage)
          loadGameState() // Обновить состояние, чтобы получить актуальную фазу
          return
        }
        
        throw new Error(errorMessage)
      }

      loadGameState()
    } catch (err) {
      console.error("Error advancing round:", err)
      // Не устанавливаем ошибку для ошибок фазы - это может быть проблема синхронизации
      const errorMessage = err instanceof Error ? err.message : "Failed to advance round"
      if (!errorMessage.includes("Must be in") || !errorMessage.includes("phase")) {
        setError(errorMessage)
      }
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
      console.error("Error eliminating player:", err)
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
      console.log("[Connection] System event:", payload)
    })

    channel.subscribe((status) => {
      console.log("[Connection] Channel status:", status)
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

  // Cast vote
  const castVote = useCallback(
    async (targetId: string) => {
      if (!gameState || !currentPlayerId) {
        throw new Error("Cannot cast vote: game state or current player ID is missing")
      }

      try {
        let response: Response
        try {
          response = await fetch("/api/game/vote", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              roomId: gameState.id,
              targetPlayerId: targetId,
            }),
          })
        } catch (fetchError) {
          // Handle network errors (connection failed, CORS, etc.)
          const networkError = fetchError instanceof Error 
            ? fetchError.message 
            : String(fetchError)
          console.error("[Vote] Network error:", {
            error: networkError,
            gameStateId: gameState.id,
            targetId,
            fetchError
          })
          throw new Error(`Network error: ${networkError}. Please check your connection.`)
        }

        // Read response as text first (can only read once)
        const contentType = response.headers.get("content-type")
        const text = await response.text()

        if (!text || !text.trim()) {
          console.error("[Vote] Empty response:", {
            status: response.status,
            statusText: response.statusText,
            contentType
          })
          throw new Error(`Empty response from server: ${response.status} ${response.statusText}`)
        }

        // Parse JSON from text
        let responseData: any = null
        try {
          responseData = JSON.parse(text)
        } catch (parseError) {
          console.error("[Vote] Failed to parse JSON:", {
            parseError,
            status: response.status,
            statusText: response.statusText,
            contentType,
            responseText: text.substring(0, 200)
          })
          throw new Error(`Invalid JSON response: ${response.status} ${response.statusText}. Response: ${text.substring(0, 100)}`)
        }

        if (!response.ok) {
          // Ensure we have error information - extract from responseData properly
          let errorMessage: string = ""
          
          // Try to extract error message from responseData
          if (responseData) {
            // Check error field
            if (responseData.error) {
              if (typeof responseData.error === 'string') {
                errorMessage = responseData.error
              } else if (typeof responseData.error === 'object') {
                errorMessage = responseData.error.message || responseData.error.error || JSON.stringify(responseData.error)
              }
            }
            
            // Check message field if error not found
            if (!errorMessage && responseData.message) {
              if (typeof responseData.message === 'string') {
                errorMessage = responseData.message
              } else if (typeof responseData.message === 'object') {
                errorMessage = responseData.message.message || JSON.stringify(responseData.message)
              }
            }
          }
          
          // Fallback to status text if no message found
          if (!errorMessage || errorMessage === '[object Object]') {
            errorMessage = `Server error: ${response.status} ${response.statusText}`
          }
          
          const errorDetails = responseData?.details || responseData?.errors || responseData?.code || null
          
          // Build detailed error message - ensure it's always a string
          let fullErrorMessage = String(errorMessage)
          if (errorDetails) {
            if (typeof errorDetails === 'string') {
              fullErrorMessage = `${errorMessage}: ${errorDetails}`
            } else if (typeof errorDetails === 'object') {
              try {
                const detailsStr = JSON.stringify(errorDetails, null, 2)
                fullErrorMessage = `${errorMessage}\nDetails: ${detailsStr}`
              } catch {
                fullErrorMessage = `${errorMessage} (See console for details)`
              }
            } else {
              fullErrorMessage = `${errorMessage} (${String(errorDetails)})`
            }
          }

          // Log full response data for debugging
          console.error("[Vote] Failed to cast vote - Server response:", {
            status: response.status,
            statusText: response.statusText,
            errorMessage: errorMessage,
            errorDetails: errorDetails,
            fullResponse: responseData,
            responseText: text?.substring(0, 500),
            contentType
          })
          
          // Also log responseData separately to see its structure
          console.error("[Vote] Full responseData object:", JSON.stringify(responseData, null, 2))
          
          // Extract additional info from responseData for better error message
          let additionalInfo = ""
          if (responseData?.details) {
            if (typeof responseData.details === 'string') {
              additionalInfo = responseData.details
            } else if (typeof responseData.details === 'object') {
              // Try to extract message from details object
              if (responseData.details.message) {
                additionalInfo = String(responseData.details.message)
              } else {
                try {
                  additionalInfo = JSON.stringify(responseData.details, null, 2)
                } catch {
                  additionalInfo = "See console for details"
                }
              }
            }
          }
          
          // Build final error message
          let finalErrorMessage = errorMessage
          if (additionalInfo && !finalErrorMessage.includes(additionalInfo)) {
            finalErrorMessage = `${errorMessage}${additionalInfo ? `: ${additionalInfo}` : ''}`
          }

          // Create error with proper message - ensure message is always a string and doesn't contain [object Object]
          let cleanErrorMessage = String(finalErrorMessage).replace(/\[object Object\]/g, '')
          if (!cleanErrorMessage || cleanErrorMessage.trim() === '') {
            cleanErrorMessage = `Server error: ${response.status} ${response.statusText}`
          }
          
          const voteError = new Error(cleanErrorMessage)
          // Attach additional info to error object for debugging
          ;(voteError as any).status = response.status
          ;(voteError as any).responseData = responseData
          throw voteError
        }

        // Vote cast successfully
        console.log("[Vote] Vote cast successfully:", responseData)
        
        // Don't reload full state, just update votes locally
        // Votes will be synced via realtime
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
            console.error("[Vote] Extracting error from responseData:", responseData)
            
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
        console.error("Error casting vote:", errorString)
        console.error("Error casting vote (detailed):", {
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
            console.error("Error properties:", props)
            props.forEach(prop => {
              try {
                const value = (err as any)[prop]
                console.error(`  ${prop}:`, value)
              } catch (e) {
                console.error(`  ${prop}: [unable to read]`)
              }
            })
          } catch (e) {
            console.error("Could not enumerate error properties:", e)
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
        console.error("Error updating characteristic:", err)
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
        console.error("Error randomizing characteristic:", err)
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
        console.error("Error exchanging characteristics:", err)
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
        console.error("Error toggling ready status:", err)
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
        console.error("[GameState] Failed to fetch special cards")
        return []
      }

      const data = await response.json()
      return data.cards || []
    } catch (err) {
      console.error("[GameState] Error fetching special cards:", err)
      return []
    }
  }, [gameState, currentPlayerId])

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
            console.error("Error using special card:", errorMessage)
          }
          throw new Error(errorMessage)
        }

        // Reload game state to reflect changes
        loadGameState()
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to use special card"
        // Don't log expected errors for eliminated players
        if (!errorMessage.includes("Eliminated players cannot use special cards")) {
          console.error("Error using special card:", err)
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
    loading,
    isRefreshing,
    error,
    connectionState,
    reconnect: loadGameState,
    toggleCharacteristic,
    revealCharacteristic,
    startVoting,
    nextRound,
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
  }
}
