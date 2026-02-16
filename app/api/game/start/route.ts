import { NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { getAllowedSpecialCardTypes } from "@/lib/game/special-cards-types"
import { WHOAMI_DEFAULT_WORDS } from "@/lib/game/whoami-words"

// POST - Start game
export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { roomId } = body

    // Get room and verify host
    const { data: room, error: roomError } = await supabase
      .from("game_rooms")
      .select("*, game_players(*)")
      .eq("id", roomId)
      .single()

    if (roomError || !room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 })
    }

    if (room.host_id !== user.id) {
      return NextResponse.json({ error: "Only host can start the game" }, { status: 403 })
    }

    if (room.phase !== "waiting") {
      return NextResponse.json({ 
        error: "Game already started",
        currentPhase: room.phase,
        message: `Game is already in ${room.phase} phase` 
      }, { status: 400 })
    }

    // Get host role setting
    const hostRole = (room.settings as any)?.hostRole || "host_and_player"
    
    // Get round mode setting
    const roundMode = (room.settings as any)?.roundMode || "automatic"
    
    // Get players that should be checked for readiness:
    // 1. Exclude host (host doesn't need to be ready)
    // 2. Only players who have joined (are in game_players table)
    const playersToCheck = room.game_players.filter((p: any) => p.user_id !== room.host_id)

    // Check if all non-host players are ready
    const readyPlayers = playersToCheck.filter((p: any) => p.is_ready === true)
    const allReady = playersToCheck.length > 0 && playersToCheck.every((p: any) => p.is_ready === true)

    if (!allReady) {
      return NextResponse.json({ 
        error: "Not all players are ready",
        readyCount: readyPlayers.length,
        totalCount: playersToCheck.length,
        message: `Готово ${readyPlayers.length} из ${playersToCheck.length} игроков. Все игроки должны быть готовы для начала игры.`
      }, { status: 400 })
    }

    // Count actual players for game start (excluding host if in "host_only" mode)
    const actualPlayers = hostRole === "host_only" 
      ? room.game_players.filter((p: any) => p.user_id !== room.host_id)
      : room.game_players

    // Temporarily allow starting with 1 player for testing
    if (actualPlayers.length < 1) {
      return NextResponse.json({ error: "Need at least 1 player" }, { status: 400 })
    }

    // Reset ready status for all players when game starts
    await supabase
      .from("game_players")
      .update({ is_ready: false })
      .eq("room_id", roomId)

    // Update room to playing phase
    // Don't start timer yet - wait for catastrophe intro screen to be skipped
    // Timer will be started when host skips the catastrophe intro
    const updateData: any = {
      phase: "playing",
      current_round: 1,
      round_started_at: null, // Keep null until catastrophe intro is skipped
    }
    
    const { error: updateError } = await supabase
      .from("game_rooms")
      .update(updateData)
      .eq("id", roomId)

    if (updateError) throw updateError

    // Count this room as "game started" for host (social achievements: rooms created and started)
    if (room.host_id) {
      await supabase.rpc("increment_games_hosted", { user_id_param: room.host_id })
    }

    const settings = (room.settings as Record<string, unknown>) || {}
    const gameMode = (settings.gameMode as string) || "bunker"

    // Режим "Кто Я?": назначаем слова, не выдаём спецкарты
    if (gameMode === "whoami") {
      const wordsPerPlayer = Math.max(1, Math.min(20, Number(settings.whoamiWordsPerPlayer) || 5))
      const customWordsRaw = (settings.whoamiCustomWords as string) || ""
      const customWords = customWordsRaw
        .split(/[,;]+/)
        .map((w) => w.trim())
        .filter((w) => w.length > 0)

      const wordPool = customWords.length >= wordsPerPlayer * actualPlayers.length
        ? customWords
        : [...WHOAMI_DEFAULT_WORDS]

      const shuffle = <T>(arr: T[]): T[] => {
        const a = [...arr]
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[a[i], a[j]] = [a[j], a[i]]
        }
        return a
      }

      const shuffled = shuffle(wordPool)
      const totalNeeded = actualPlayers.length * wordsPerPlayer
      if (shuffled.length < totalNeeded) {
        return NextResponse.json(
          { error: "Недостаточно слов для игры. Добавьте свои слова или уменьшите количество слов на игрока." },
          { status: 400 }
        )
      }

      const toAssign = shuffled.slice(0, totalNeeded)
      const inserts: { player_id: string; word: string; word_index: number; is_guessed: boolean }[] = []
      let idx = 0
      for (const player of actualPlayers) {
        for (let i = 0; i < wordsPerPlayer; i++) {
          inserts.push({
            player_id: player.id,
            word: toAssign[idx],
            word_index: i,
            is_guessed: false,
          })
          idx++
        }
      }

      const { error: whoamiError } = await supabase.from("player_whoami_words").insert(inserts)
      if (whoamiError) {
        console.error("[GameStart] Whoami words insert error:", whoamiError)
        return NextResponse.json({ error: "Не удалось назначить слова игрокам" }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    }

    // Grant special cards to all players (только для режима Бункер)
    const characteristicsSettings = (settings.characteristics as Record<string, { enabled?: boolean }>) || {}
    const allowedCardTypes = getAllowedSpecialCardTypes(characteristicsSettings)
    const cardTypes = [...allowedCardTypes]
    const cardsPerPlayer = Math.max(1, Number(settings.specialCardsPerPlayer) || 1)
    console.log("[GameStart] === Starting card granting process ===")
    console.log("[GameStart] Room ID:", roomId)
    console.log("[GameStart] Players in room:", room.game_players?.length || 0)
    console.log("[GameStart] Cards per player:", cardsPerPlayer)
    console.log("[GameStart] Allowed card types (filtered by enabled characteristics):", cardTypes.length)
    
    try {
      // Check if players are loaded
      if (!room.game_players || room.game_players.length === 0) {
        console.error("[GameStart] ❌ No players found in room - cannot grant cards")
        console.error("[GameStart] Room data:", { roomId, hasGamePlayers: !!room.game_players, gamePlayersLength: room.game_players?.length })
        // Don't fail game start, but log error
      } else {
        console.log(`[GameStart] ✅ Found ${room.game_players.length} players to grant cards to`)
        console.log("[GameStart] Player IDs:", room.game_players.map((p: any) => ({ id: p.id, name: p.name, userId: p.user_id })))
      }
      console.log(`[GameStart] Available card types: ${cardTypes.length} types`)

      if (cardTypes.length === 0) {
        console.warn("[GameStart] ⚠️ No allowed card types after filtering - cannot grant cards")
      }

      // Каждому игроку выдаём до cardsPerPlayer карт. Уникальный индекс (player_id, card_type) допускает
      // только одну карту каждого типа на игрока, поэтому выбираем без повторений.
      const cardsPerPlayerActual = cardTypes.length === 0 ? 0 : Math.min(cardsPerPlayer, cardTypes.length)
      const shuffle = <T>(arr: T[]): T[] => {
        const a = [...arr]
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[a[i], a[j]] = [a[j], a[i]]
        }
        return a
      }
      const cardsToInsert: { player_id: string; room_id: string; card_type: string; is_used: boolean }[] = []
      for (const player of room.game_players) {
        const shuffled = shuffle(cardTypes)
        const typesForPlayer = shuffled.slice(0, cardsPerPlayerActual)
        for (const cardType of typesForPlayer) {
          cardsToInsert.push({
            player_id: player.id,
            room_id: roomId,
            card_type: cardType,
            is_used: false,
          })
        }
      }

      console.log(`[GameStart] Prepared ${cardsToInsert.length} cards to insert (${room.game_players.length} players × ${cardsPerPlayer} cards each)`)
      console.log("[GameStart] Cards to grant:", cardsToInsert.map((c: any) => ({ playerId: c.player_id.substring(0, 8) + "...", cardType: c.card_type })))
      
      if (cardsToInsert.length > 0) {
        console.log(`[GameStart] 🔄 Inserting ${cardsToInsert.length} special cards into database...`)
        console.log("[GameStart] First 3 cards sample:", cardsToInsert.slice(0, 3))
        
        // Try to insert with regular client first (will work if RLS policy allows host to insert)
        let insertError: any = null
        let insertedCards: any = null
        
        const { error: insertError1, data: insertedCards1 } = await supabase
          .from("special_cards")
          .insert(cardsToInsert)
          .select()

        if (insertError1) {
          console.warn("[GameStart] ⚠️ Insert with regular client failed, trying service role client:", {
            code: insertError1.code,
            message: insertError1.message,
            details: insertError1.details,
            hint: insertError1.hint,
          })
          
          // If regular client fails, try with service role client (bypasses RLS)
          try {
            const serviceRoleClient = createServiceRoleClient()
            const { error: insertError2, data: insertedCards2 } = await serviceRoleClient
              .from("special_cards")
              .insert(cardsToInsert)
              .select()
            
            if (insertError2) {
              insertError = insertError2
              console.error("[GameStart] ❌ Service role client also failed:", insertError2)
            } else {
              insertedCards = insertedCards2
              console.log("[GameStart] ✅ Service role client succeeded - cards granted via service role")
            }
          } catch (serviceRoleError: any) {
            console.error("[GameStart] ❌ Failed to create service role client:", {
              error: serviceRoleError,
              message: serviceRoleError?.message,
              hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
            })
            insertError = insertError1 // Use original error
          }
        } else {
          insertedCards = insertedCards1
          console.log("[GameStart] ✅ Regular client succeeded - cards granted via host RLS policy")
        }

        if (insertError) {
          console.error("[GameStart] ❌ Failed to grant special cards after all attempts:", insertError)
          console.error("[GameStart] Error details:", {
            code: insertError.code,
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint,
            error: insertError,
          })
          // Don't fail game start if card granting fails
        } else if (insertedCards) {
          console.log(`[GameStart] ✅ Successfully granted ${insertedCards?.length || 0} special cards`)
          console.log("[GameStart] First 3 inserted cards:", insertedCards?.slice(0, 3))
          
          // Verify cards were inserted for each player
          const cardsByPlayer = new Map<string, number>()
          insertedCards?.forEach((card: any) => {
            const count = cardsByPlayer.get(card.player_id) || 0
            cardsByPlayer.set(card.player_id, count + 1)
          })
          
          console.log("[GameStart] Cards granted per player:")
          cardsByPlayer.forEach((count, playerId) => {
            const player = room.game_players.find((p: any) => p.id === playerId)
            console.log(`[GameStart]   - Player ${player?.name || playerId}: ${count} cards`)
          })
        }
      } else {
        console.warn("[GameStart] ⚠️ No cards to insert - cardTypes array might be empty or no players")
        console.warn("[GameStart] Debug info:", {
          playersCount: room.game_players?.length || 0,
          cardTypesCount: cardTypes.length,
          cardsToInsertLength: cardsToInsert.length,
        })
      }
    } catch (grantError: any) {
      console.error("[GameStart] ❌ Exception while granting special cards:", grantError)
      console.error("[GameStart] Error details:", {
        error: grantError,
        errorName: grantError?.name,
        errorMessage: grantError?.message,
        errorStack: grantError?.stack,
      })
      // Don't fail game start if card granting fails
    }
    
    console.log("[GameStart] === Card granting process completed ===")

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error starting game:", error)
    return NextResponse.json({ error: "Failed to start game" }, { status: 500 })
  }
}
