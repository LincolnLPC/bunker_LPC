import { NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { validatePlayerId, validateRoomId } from "@/lib/security/validation"

// Helper function to get card name from card type
function getCardName(cardType: string): string {
  // Category-specific exchange cards
  if (cardType.startsWith("exchange-")) {
    const category = cardType.replace("exchange-", "")
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
    if (categoryLabels[category]) {
      return `Обмен ${categoryLabel.toLowerCase()}`
    }
    return ""
  }
  
  // Category-specific reshuffle cards
  if (cardType.startsWith("reshuffle-")) {
    const category = cardType.replace("reshuffle-", "")
    const categoryLabels: Record<string, string> = {
      health: "Здоровья",
      bio: "Биологии",
      fact: "Фактов",
      baggage: "Багажа",
      hobby: "Хобби",
    }
    const categoryLabel = categoryLabels[category] || category
    if (categoryLabels[category]) {
      return `Давайте начистоту: ${categoryLabel}`
    }
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
  return names[cardType] || cardType
}

// GET - Get player's special cards
export async function GET(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const playerId = searchParams.get("playerId")
    const roomId = searchParams.get("roomId")

    if (!playerId || !roomId) {
      return NextResponse.json({ error: "Player ID and Room ID required" }, { status: 400 })
    }

    // Validate inputs
    const playerIdValidation = validatePlayerId(playerId)
    const roomIdValidation = validateRoomId(roomId)

    if (!playerIdValidation.valid || !roomIdValidation.valid) {
      return NextResponse.json(
        {
          error: "Validation failed",
          errors: [...playerIdValidation.errors, ...roomIdValidation.errors],
        },
        { status: 400 }
      )
    }

    // Verify player belongs to user
    const { data: player, error: playerError } = await supabase
      .from("game_players")
      .select("id, user_id")
      .eq("id", playerId)
      .single()

    if (playerError || !player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    if (player.user_id !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Get special cards
    console.log(`[SpecialCards] 🔍 Fetching cards for player ${playerId} in room ${roomId}`)
    
    const { data: cards, error: cardsError } = await supabase
      .from("special_cards")
      .select("*")
      .eq("player_id", playerId)
      .eq("room_id", roomId)
      .order("created_at", { ascending: true })

    if (cardsError) {
      console.error("[SpecialCards] ❌ Error fetching cards:", {
        error: cardsError,
        code: cardsError.code,
        message: cardsError.message,
        details: cardsError.details,
        hint: cardsError.hint,
        playerId,
        roomId,
      })
      throw cardsError
    }

    console.log(`[SpecialCards] ✅ Fetched ${cards?.length || 0} cards for player ${playerId} in room ${roomId}`)
    
    // Check if there are any cards for this room (for debugging)
    const { data: allRoomCards, error: allRoomCardsError } = await supabase
      .from("special_cards")
      .select("player_id, card_type, is_used")
      .eq("room_id", roomId)
      .limit(100)
    
    if (!allRoomCardsError && allRoomCards) {
      console.log(`[SpecialCards] 📊 Total cards in room ${roomId}: ${allRoomCards.length}`)
      
      // Count cards by player
      const cardsByPlayer = new Map<string, number>()
      allRoomCards.forEach((card: any) => {
        const count = cardsByPlayer.get(card.player_id) || 0
        cardsByPlayer.set(card.player_id, count + 1)
      })
      
      console.log("[SpecialCards] Cards per player in room:")
      cardsByPlayer.forEach((count, playerId) => {
        console.log(`[SpecialCards]   - Player ${playerId}: ${count} cards`)
      })
      
      if (allRoomCards.length === 0) {
        console.warn(`[SpecialCards] ⚠️ No cards found for ANY player in room ${roomId} - cards may not have been granted yet`)
      }
    }
    
    if (cards && cards.length > 0) {
      console.log("[SpecialCards] Cards details for player:", cards.map((c) => ({ id: c.id, type: c.card_type, is_used: c.is_used, created_at: c.created_at })))
    } else {
      console.warn(`[SpecialCards] ⚠️ No cards found for player ${playerId} in room ${roomId}`)
      console.warn("[SpecialCards] This might mean:")
      console.warn("[SpecialCards]   1. Cards were not granted when game started")
      console.warn("[SpecialCards]   2. Player ID doesn't match any granted cards")
      console.warn("[SpecialCards]   3. Room ID doesn't match any granted cards")
    }

    return NextResponse.json({ cards: cards || [] })
  } catch (error) {
    console.error("[SpecialCards] Error:", error)
    return NextResponse.json({ error: "Failed to fetch special cards" }, { status: 500 })
  }
}

// POST - Use a special card
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let body: any
    try {
      body = await request.json()
    } catch (parseError: any) {
      console.error("[SpecialCards] Error parsing request body:", parseError)
      return NextResponse.json(
        { error: "Invalid request body", details: parseError?.message },
        { status: 400 }
      )
    }
    const { playerId, roomId, cardId, cardType, targetPlayerId, characteristicId, category } = body

    if (!playerId || !roomId || !cardId || !cardType) {
      return NextResponse.json(
        { error: "Player ID, Room ID, Card ID, and Card Type required" },
        { status: 400 }
      )
    }

    // Validate inputs
    const playerIdValidation = validatePlayerId(playerId)
    const roomIdValidation = validateRoomId(roomId)

    if (!playerIdValidation.valid || !roomIdValidation.valid) {
      return NextResponse.json(
        {
          error: "Validation failed",
          errors: [...playerIdValidation.errors, ...roomIdValidation.errors],
        },
        { status: 400 }
      )
    }

    // Get room and verify phase
    const { data: room, error: roomError } = await supabase
      .from("game_rooms")
      .select("*, game_players(*)")
      .eq("id", roomId)
      .single()

    if (roomError || !room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 })
    }

    // Cards can only be used during playing or voting phase
    if (room.phase !== "playing" && room.phase !== "voting") {
      return NextResponse.json({ error: "Special cards can only be used during playing or voting phase" }, { status: 400 })
    }

    // Verify player belongs to user
    const player = room.game_players.find((p: { id: string; user_id: string }) => p.id === playerId)
    if (!player || player.user_id !== user.id) {
      return NextResponse.json({ error: "Player not found or access denied" }, { status: 403 })
    }

    if (player.is_eliminated) {
      return NextResponse.json({ error: "Eliminated players cannot use special cards" }, { status: 403 })
    }

    // Get the card
    const { data: card, error: cardError } = await supabase
      .from("special_cards")
      .select("*")
      .eq("id", cardId)
      .eq("player_id", playerId)
      .eq("room_id", roomId)
      .single()

    if (cardError || !card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 })
    }

    if (card.is_used) {
      return NextResponse.json({ error: "Card already used" }, { status: 400 })
    }

    if (card.card_type !== cardType) {
      return NextResponse.json({ error: "Card type mismatch" }, { status: 400 })
    }

    // Mark card as used
    const { error: updateError } = await supabase
      .from("special_cards")
      .update({
        is_used: true,
        used_at: new Date().toISOString(),
        used_in_round: room.current_round,
      })
      .eq("id", cardId)

    if (updateError) {
      console.error("[SpecialCards] Error updating card:", updateError)
      throw updateError
    }

    // Execute card action based on type
    let actionResult: any = null

    // Check if it's a category-specific exchange card
    const isCategoryExchange = cardType.startsWith("exchange-")
    const exchangeCategory = isCategoryExchange ? cardType.replace("exchange-", "") : null
    
    // Handle category-specific exchange cards first
    if (isCategoryExchange) {
      if (!targetPlayerId || !characteristicId) {
        return NextResponse.json(
          { error: "Target player and characteristic required for exchange" },
          { status: 400 }
        )
      }
      // Use the same handler but verify category matches
      actionResult = await handleExchangeCard(supabase, playerId, roomId, targetPlayerId, characteristicId, exchangeCategory)
    } else {
      // Handle all other card types
      switch (cardType) {
        case "exchange":
          if (!targetPlayerId || !characteristicId) {
            return NextResponse.json(
              { error: "Target player and characteristic required for exchange" },
              { status: 400 }
            )
          }
          actionResult = await handleExchangeCard(supabase, playerId, roomId, targetPlayerId, characteristicId)
          break

        case "reveal":
        if (!targetPlayerId || !category) {
          return NextResponse.json(
            { error: "Target player and category required for reveal" },
            { status: 400 }
          )
        }
        actionResult = await handleRevealCard(supabase, playerId, roomId, targetPlayerId, category)
        break

      case "reroll":
        if (!characteristicId) {
          return NextResponse.json({ error: "Characteristic required for reroll" }, { status: 400 })
        }
        actionResult = await handleRerollCard(supabase, playerId, roomId, characteristicId)
        break

      case "steal":
        if (!targetPlayerId || !characteristicId) {
          return NextResponse.json(
            { error: "Target player and characteristic required for steal" },
            { status: 400 }
          )
        }
        actionResult = await handleStealCard(supabase, playerId, roomId, targetPlayerId, characteristicId)
        break

      case "immunity":
        actionResult = await handleImmunityCard(supabase, playerId, roomId)
        break

      case "double-vote":
        actionResult = await handleDoubleVoteCard(supabase, playerId, roomId)
        break

      case "no-vote-against":
        if (!targetPlayerId) {
          return NextResponse.json(
            { error: "Target player required for no-vote-against" },
            { status: 400 }
          )
        }
        actionResult = await handleNoVoteAgainstCard(supabase, playerId, roomId, targetPlayerId)
        break

      case "reshuffle":
        if (!category) {
          return NextResponse.json(
            { error: "Category required for reshuffle" },
            { status: 400 }
          )
        }
        actionResult = await handleReshuffleCard(supabase, playerId, roomId, category)
        break

      // Category-specific reshuffle cards
      case "reshuffle-health":
        actionResult = await handleReshuffleCard(supabase, playerId, roomId, "health")
        break
      case "reshuffle-bio":
        actionResult = await handleReshuffleCard(supabase, playerId, roomId, "bio")
        break
      case "reshuffle-fact":
        actionResult = await handleReshuffleCard(supabase, playerId, roomId, "fact")
        break
      case "reshuffle-baggage":
        actionResult = await handleReshuffleCard(supabase, playerId, roomId, "baggage")
        break
      case "reshuffle-hobby":
        actionResult = await handleReshuffleCard(supabase, playerId, roomId, "hobby")
        break

      case "revote":
        actionResult = await handleRevoteCard(supabase, playerId, roomId)
        break

      case "replace-profession":
        if (!targetPlayerId || !characteristicId) {
          return NextResponse.json(
            { error: "Target player and characteristic required for replace-profession" },
            { status: 400 }
          )
        }
        actionResult = await handleReplaceProfessionCard(supabase, playerId, roomId, targetPlayerId, characteristicId)
        break

      case "replace-health":
        if (!targetPlayerId || !characteristicId) {
          return NextResponse.json(
            { error: "Target player and characteristic required for replace-health" },
            { status: 400 }
          )
        }
        actionResult = await handleReplaceHealthCard(supabase, playerId, roomId, targetPlayerId, characteristicId)
        break

      default:
        return NextResponse.json({ error: "Unknown card type" }, { status: 400 })
      }
    }

    // Add system message to chat about card usage
    const playerName = player.name || "Игрок"
    const cardName = getCardName(cardType) || cardType
    await supabase.from("chat_messages").insert({
      room_id: roomId,
      player_id: null, // System message
      message: `${playerName} использовал карту: ${cardName}`,
      message_type: "system",
    })

    return NextResponse.json({
      success: true,
      card: {
        ...card,
        is_used: true,
        used_at: new Date().toISOString(),
        used_in_round: room.current_round,
      },
      actionResult,
    })
  } catch (error: any) {
    // Ensure we always have a valid JSON response, even on errors
    console.error("[SpecialCards] Error using card:", {
      error,
      errorName: error?.name,
      errorMessage: error?.message,
      errorStack: error?.stack,
      errorCode: error?.code,
      errorDetails: error?.details,
    })
    
    // Extract meaningful error message
    let errorMessage = "Failed to use special card"
    if (error?.message) {
      errorMessage = error.message
    } else if (typeof error === "string") {
      errorMessage = error
    }
    
    // Return error response with proper JSON format
    try {
      return NextResponse.json(
        { 
          error: errorMessage,
          details: process.env.NODE_ENV === "development" ? error?.stack : undefined,
          code: error?.code,
        },
        { status: 500 }
      )
    } catch (jsonError: any) {
      // If we can't even return JSON, log it and return a simple text response
      console.error("[SpecialCards] CRITICAL: Cannot return JSON error response:", jsonError)
      return new Response(
        JSON.stringify({ error: errorMessage }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      )
    }
  }
}

// Helper functions for card actions

async function handleExchangeCard(
  supabase: any,
  playerId: string,
  roomId: string,
  targetPlayerId: string,
  characteristicId: string,
  requiredCategory?: string | null,
) {
  // Exchange one characteristic with another player
  // RLS blocks updating other players' characteristics — use service role for both updates
  let updateClient: any = supabase
  try {
    const serviceRole = createServiceRoleClient()
    updateClient = serviceRole
  } catch {
    console.warn("[SpecialCards] Service role unavailable, using regular client (may fail for target update)")
  }

  // Get current player's characteristic to exchange
  const { data: playerChars, error: playerCharsError } = await supabase
    .from("player_characteristics")
    .select("*")
    .eq("player_id", playerId)
    .eq("id", characteristicId)
    .single()

  if (playerCharsError || !playerChars) {
    throw new Error("Characteristic not found")
  }

  // If requiredCategory is specified (for category-specific exchange cards), verify it matches
  if (requiredCategory && playerChars.category !== requiredCategory) {
    throw new Error(`Characteristic category mismatch. Expected ${requiredCategory}, got ${playerChars.category}`)
  }

  // Get target player's characteristic of same category
  const { data: targetChars, error: targetCharsError } = await supabase
    .from("player_characteristics")
    .select("*")
    .eq("player_id", targetPlayerId)
    .eq("category", playerChars.category)
    .limit(1)
    .single()

  if (targetCharsError || !targetChars) {
    throw new Error("Target player does not have a characteristic of this category")
  }

  // Exchange values — both updates via updateClient (service role) to bypass RLS
  const playerValue = playerChars.value
  const targetValue = targetChars.value

  const { error: updatePlayerError } = await updateClient
    .from("player_characteristics")
    .update({ value: targetValue })
    .eq("id", characteristicId)

  if (updatePlayerError) throw updatePlayerError

  const { error: updateTargetError } = await updateClient
    .from("player_characteristics")
    .update({ value: playerValue })
    .eq("id", targetChars.id)

  if (updateTargetError) throw updateTargetError

  return { type: "exchange", exchanged: true, characteristicId, targetCharacteristicId: targetChars.id }
}

async function handleRevealCard(
  supabase: any,
  playerId: string,
  roomId: string,
  targetPlayerId: string,
  category: string,
) {
  // Reveal the first hidden characteristic of the specified category
  // Get target player's hidden characteristics of the specified category
  const { data: characteristics, error: charsError } = await supabase
    .from("player_characteristics")
    .select("*")
    .eq("player_id", targetPlayerId)
    .eq("category", category)
    .eq("is_revealed", false)
    .order("sort_order", { ascending: true })
    .limit(1)

  if (charsError) throw charsError

  if (!characteristics || characteristics.length === 0) {
    throw new Error(`Target player does not have a hidden characteristic of category: ${category}`)
  }

  const characteristic = characteristics[0]

  // Get current round
  const { data: room, error: roomError } = await supabase
    .from("game_rooms")
    .select("current_round")
    .eq("id", roomId)
    .single()

  if (roomError) throw roomError

  // Reveal the characteristic — use service role (RLS blocks updating other player's char)
  let updateClient: any = supabase
  try {
    updateClient = createServiceRoleClient()
  } catch {
    console.warn("[SpecialCards] Service role unavailable for reveal")
  }
  const { error: updateError } = await updateClient
    .from("player_characteristics")
    .update({
      is_revealed: true,
      reveal_round: room.current_round || 0,
    })
    .eq("id", characteristic.id)
    .eq("player_id", targetPlayerId)

  if (updateError) throw updateError

  return { type: "reveal", characteristicId: characteristic.id, category, revealed: true }
}

async function handleRerollCard(supabase: any, playerId: string, roomId: string, characteristicId: string) {
  // Reroll (randomize) one of player's characteristics
  const { data: characteristic, error: charError } = await supabase
    .from("player_characteristics")
    .select("*")
    .eq("player_id", playerId)
    .eq("id", characteristicId)
    .single()

  if (charError || !characteristic) {
    throw new Error("Characteristic not found")
  }

  // Import characteristics utility
  const { getRandomCharacteristic } = await import("@/lib/game/characteristics")

  // Get random value for the category
  const newValue = getRandomCharacteristic(characteristic.category as any)

  if (!newValue) {
    throw new Error(`Cannot reroll category: ${characteristic.category}`)
  }

  const { error: updateError } = await supabase
    .from("player_characteristics")
    .update({ value: newValue })
    .eq("id", characteristicId)

  if (updateError) throw updateError

  return { type: "reroll", characteristicId, newValue, oldValue: characteristic.value }
}

async function handleStealCard(
  supabase: any,
  playerId: string,
  roomId: string,
  targetPlayerId: string,
  characteristicId: string,
) {
  // Steal a characteristic from another player — use service role for target delete/update (RLS)
  let writeClient: any = supabase
  try {
    writeClient = createServiceRoleClient()
  } catch {
    console.warn("[SpecialCards] Service role unavailable for steal")
  }

  const { data: targetChar, error: targetCharError } = await supabase
    .from("player_characteristics")
    .select("*")
    .eq("player_id", targetPlayerId)
    .eq("id", characteristicId)
    .single()

  if (targetCharError || !targetChar) {
    throw new Error("Characteristic not found")
  }

  // Check if player already has a characteristic of this category
  const { data: existingChar, error: existingError } = await supabase
    .from("player_characteristics")
    .select("*")
    .eq("player_id", playerId)
    .eq("category", targetChar.category)
    .limit(1)
    .single()

  if (existingChar) {
    // Replace existing characteristic (own row — OK with regular client, but use writeClient for consistency)
    const { error: updateError } = await writeClient
      .from("player_characteristics")
      .update({ value: targetChar.value })
      .eq("id", existingChar.id)

    if (updateError) throw updateError

    // Remove from target player (RLS would block — must use service role)
    const { error: deleteError } = await writeClient
      .from("player_characteristics")
      .delete()
      .eq("id", characteristicId)

    if (deleteError) throw deleteError

    return { type: "steal", characteristicId, stolenValue: targetChar.value, replacedCharacteristicId: existingChar.id }
  } else {
    // Create new characteristic for player
    const { error: insertError } = await writeClient.from("player_characteristics").insert({
      player_id: playerId,
      category: targetChar.category,
      name: targetChar.name,
      value: targetChar.value,
      is_revealed: false,
      sort_order: targetChar.sort_order,
    })

    if (insertError) throw insertError

    // Remove from target player (RLS would block — must use service role)
    const { error: deleteError } = await writeClient
      .from("player_characteristics")
      .delete()
      .eq("id", characteristicId)

    if (deleteError) throw deleteError

    return { type: "steal", characteristicId, stolenValue: targetChar.value }
  }
}

async function handleImmunityCard(supabase: any, playerId: string, roomId: string) {
  // Grant immunity for this round (store in player metadata or separate table)
  // For simplicity, we'll store immunity in a JSON field in game_players
  const { data: player, error: playerError } = await supabase
    .from("game_players")
    .select("metadata, room_id")
    .eq("id", playerId)
    .single()

  if (playerError) throw playerError

  const { data: room, error: roomError } = await supabase
    .from("game_rooms")
    .select("current_round")
    .eq("id", roomId)
    .single()

  if (roomError) throw roomError

  // Handle metadata - parse if string, use object if already parsed
  let metadata: any = {}
  try {
    if (player.metadata) {
      if (typeof player.metadata === 'string') {
        metadata = JSON.parse(player.metadata)
      } else {
        metadata = player.metadata
      }
    }
  } catch (e) {
    console.warn("[SpecialCards] Error parsing metadata:", e)
    metadata = {}
  }

  metadata.immunity = {
    active: true,
    round: room.current_round,
    granted_at: new Date().toISOString(),
  }

  const { error: updateError } = await supabase
    .from("game_players")
    .update({ metadata })
    .eq("id", playerId)

  if (updateError) throw updateError

  return { type: "immunity", active: true, round: room.current_round }
}

async function handleDoubleVoteCard(supabase: any, playerId: string, roomId: string) {
  // Grant double vote for this round (store in player metadata)
  const { data: player, error: playerError } = await supabase
    .from("game_players")
    .select("metadata, room_id")
    .eq("id", playerId)
    .single()

  if (playerError) throw playerError

  const { data: room, error: roomError } = await supabase
    .from("game_rooms")
    .select("current_round")
    .eq("id", roomId)
    .single()

  if (roomError) throw roomError

  // Handle metadata - parse if string, use object if already parsed
  let metadata: any = {}
  try {
    if (player.metadata) {
      if (typeof player.metadata === 'string') {
        metadata = JSON.parse(player.metadata)
      } else {
        metadata = player.metadata
      }
    }
  } catch (e) {
    console.warn("[SpecialCards] Error parsing metadata:", e)
    metadata = {}
  }

  metadata.doubleVote = {
    active: true,
    round: room.current_round,
    granted_at: new Date().toISOString(),
  }

  const { error: updateError } = await supabase
    .from("game_players")
    .update({ metadata })
    .eq("id", playerId)

  if (updateError) throw updateError

  return { type: "double-vote", active: true, round: room.current_round }
}

async function handleNoVoteAgainstCard(
  supabase: any,
  playerId: string,
  roomId: string,
  targetPlayerId: string,
) {
  // Selected player cannot vote against you until end of game
  // Store restriction in target player's metadata
  const { data: targetPlayer, error: targetPlayerError } = await supabase
    .from("game_players")
    .select("metadata")
    .eq("id", targetPlayerId)
    .single()

  if (targetPlayerError) throw targetPlayerError

  // Handle metadata - parse if string, use object if already parsed
  let metadata: any = {}
  try {
    if (targetPlayer.metadata) {
      if (typeof targetPlayer.metadata === 'string') {
        metadata = JSON.parse(targetPlayer.metadata)
      } else {
        metadata = targetPlayer.metadata
      }
    }
  } catch (e) {
    console.warn("[SpecialCards] Error parsing metadata:", e)
    metadata = {}
  }

  if (!metadata.cannotVoteAgainst) {
    metadata.cannotVoteAgainst = []
  }
  
  // Check if restriction already exists
  const exists = metadata.cannotVoteAgainst.some((r: any) => r.playerId === playerId)
  if (!exists) {
    metadata.cannotVoteAgainst.push({
      playerId,
      granted_at: new Date().toISOString(),
    })
  }

  const { error: updateError } = await supabase
    .from("game_players")
    .update({ metadata })
    .eq("id", targetPlayerId)

  if (updateError) throw updateError

  return { type: "no-vote-against", targetPlayerId }
}

async function handleReshuffleCard(supabase: any, playerId: string, roomId: string, category: string) {
  // Collect all characteristics of specified category from non-eliminated players, shuffle and redeal
  // Each player must receive a value different from their original (derangement)
  // NOTE: We need to use service role client to update all characteristics, as RLS policies
  // only allow players to update their own characteristics or host to update any.
  // This is a system action that should work for all players.
  
  const validCategories = ["bio", "baggage", "health", "fact", "hobby"]
  if (!validCategories.includes(category)) {
    throw new Error(`Invalid category: ${category}`)
  }

  // Get all non-eliminated players
  const { data: players, error: playersError } = await supabase
    .from("game_players")
    .select("id")
    .eq("room_id", roomId)
    .eq("is_eliminated", false)

  if (playersError) throw playersError

  if (!players || players.length === 0) {
    throw new Error("No non-eliminated players found")
  }

  const playerIds = players.map((p: any) => p.id)

  // Get ALL characteristics of the category (not just revealed ones)
  console.log(`[ReshuffleCard] Fetching ${category} characteristics for players:`, {
    playerIds,
    playerCount: playerIds.length,
    roomId,
    category,
  })
  
  const { data: characteristics, error: charsError } = await supabase
    .from("player_characteristics")
    .select("*")
    .in("player_id", playerIds)
    .eq("category", category)

  if (charsError) {
    console.error(`[ReshuffleCard] Error fetching characteristics:`, charsError)
    throw charsError
  }

  if (!characteristics || characteristics.length === 0) {
    console.error(`[ReshuffleCard] No ${category} characteristics found for players:`, playerIds)
    throw new Error(`No ${category} characteristics found`)
  }

  // Log characteristics found - show details for each player
  const characteristicsByPlayer = new Map<string, any[]>()
  characteristics.forEach((c: any) => {
    if (!characteristicsByPlayer.has(c.player_id)) {
      characteristicsByPlayer.set(c.player_id, [])
    }
    characteristicsByPlayer.get(c.player_id)!.push(c)
  })

  console.log(`[ReshuffleCard] Found ${characteristics.length} ${category} characteristics for ${playerIds.length} players:`, {
    category,
    totalCharacteristics: characteristics.length,
    totalPlayers: playerIds.length,
    characteristicsByPlayer: Array.from(characteristicsByPlayer.entries()).map(([playerId, chars]) => ({
      playerId,
      count: chars.length,
      values: chars.map((c: any) => ({ id: c.id, value: c.value })),
    })),
    allCharacteristics: characteristics.map((c: any) => ({
      id: c.id,
      playerId: c.player_id,
      value: c.value,
      category: c.category,
    })),
  })

  // Check if all players have this characteristic
  if (characteristics.length !== playerIds.length) {
    const playersWithChar = new Set(characteristics.map((c: any) => c.player_id))
    const playersWithoutChar = playerIds.filter((id) => !playersWithChar.has(id))
    console.error(`[ReshuffleCard] Not all players have ${category} characteristic:`, {
      totalPlayers: playerIds.length,
      playersWithChar: characteristics.length,
      playersWithoutChar,
    })
    throw new Error(`Not all players have ${category} characteristic. Missing for ${playersWithoutChar.length} player(s)`)
  }

  // Create a map of original values by characteristic ID
  const originalValuesByCharId = new Map<string, string>()
  const charById = new Map<string, any>()
  characteristics.forEach((char: any) => {
    originalValuesByCharId.set(char.id, char.value)
    charById.set(char.id, char)
  })

  // Extract all values
  const allValues = characteristics.map((c: any) => c.value)

  // Declare shuffledValues here so it's available in all code paths
  let shuffledValues: string[] = []

  // Special case: if only 2 players, we need special handling
  // For 2 players, we must swap their values (which is a valid derangement)
  if (characteristics.length === 2) {
    const [char0, char1] = characteristics
    const original0 = originalValuesByCharId.get(char0.id)!
    const original1 = originalValuesByCharId.get(char1.id)!
    
    // If values are the same, we can't create a derangement - all values must be different
    if (original0 === original1) {
      throw new Error(`Cannot reshuffle ${category}: all players have the same value`)
    }
    
    // Swap the two values
    shuffledValues = [original1, original0]
  } else {
    // For 3+ players, use derangement algorithm
    // Create derangement: shuffle values so no player gets their original value
    // We'll use a guaranteed derangement algorithm
    shuffledValues = [...allValues]
    let isValidDerangement = false
    const maxAttempts = 200

    // Try to find a random derangement by shuffling
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Fisher-Yates shuffle
      shuffledValues = [...allValues]
      for (let i = shuffledValues.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[shuffledValues[i], shuffledValues[j]] = [shuffledValues[j], shuffledValues[i]]
      }

      // Check if this is a valid derangement (no fixed points)
      isValidDerangement = true
      for (let i = 0; i < characteristics.length; i++) {
        const char = characteristics[i]
        const originalValue = originalValuesByCharId.get(char.id)!
        if (shuffledValues[i] === originalValue) {
          isValidDerangement = false
          break
        }
      }

      if (isValidDerangement) break
    }

    // If we couldn't find a random derangement, create one deterministically
    if (!isValidDerangement) {
      console.log(`[ReshuffleCard] Creating deterministic derangement for ${category}`)
      
      // Algorithm: shift all values by one position (cyclic permutation)
      // This guarantees a derangement if n > 1
      shuffledValues = [...allValues]
      const first = shuffledValues[0]
      for (let i = 0; i < shuffledValues.length - 1; i++) {
        shuffledValues[i] = shuffledValues[i + 1]
      }
      shuffledValues[shuffledValues.length - 1] = first

      // Check if this shift creates a valid derangement
      let hasFixedPoint = false
      for (let i = 0; i < characteristics.length; i++) {
        const char = characteristics[i]
        const originalValue = originalValuesByCharId.get(char.id)!
        if (shuffledValues[i] === originalValue) {
          hasFixedPoint = true
          break
        }
      }

      // If the shift still has a fixed point (unlikely but possible if values repeat),
      // try swapping adjacent pairs
      if (hasFixedPoint) {
        for (let i = 0; i < characteristics.length; i++) {
          const char = characteristics[i]
          const originalValue = originalValuesByCharId.get(char.id)!
          
          // If this player would get their original value, find someone to swap with
          if (shuffledValues[i] === originalValue) {
            // Find another position that we can swap with
            for (let j = 0; j < characteristics.length; j++) {
              if (i === j) continue
              
              const charAtJ = characteristics[j]
              const originalAtJ = originalValuesByCharId.get(charAtJ.id)!
              
              // Check if swap is valid:
              // 1. Value at j is not the original of player at i
              // 2. Value at i is not the original of player at j
              if (shuffledValues[j] !== originalValue && shuffledValues[i] !== originalAtJ) {
                // Swap values at positions i and j
                ;[shuffledValues[i], shuffledValues[j]] = [shuffledValues[j], shuffledValues[i]]
                break
              }
            }
          }
        }
      }
    }
  }

  // Final verification: ensure no player gets their original value
  // If verification fails, try one more time with a different approach
  let needsFinalFix = false
  for (let i = 0; i < characteristics.length; i++) {
    const char = characteristics[i]
    const originalValue = originalValuesByCharId.get(char.id)!
    if (shuffledValues[i] === originalValue) {
      console.warn(`[ReshuffleCard] WARNING: Player ${char.player_id} would get their original value "${originalValue}", attempting final fix...`)
      needsFinalFix = true
      
      // Try to swap with any other value that would work
      for (let j = 0; j < shuffledValues.length; j++) {
        if (i === j) continue
        const charAtJ = characteristics[j]
        const originalAtJ = originalValuesByCharId.get(charAtJ.id)!
        
        // Check if swap would fix both
        if (shuffledValues[j] !== originalValue && shuffledValues[i] !== originalAtJ) {
          ;[shuffledValues[i], shuffledValues[j]] = [shuffledValues[j], shuffledValues[i]]
          needsFinalFix = false
          console.log(`[ReshuffleCard] Fixed by swapping positions ${i} and ${j}`)
          break
        }
      }
    }
  }
  
  // If we still have fixed points after all attempts, this is a problem
  if (needsFinalFix) {
    const fixedPoints = []
    for (let i = 0; i < characteristics.length; i++) {
      const char = characteristics[i]
      const originalValue = originalValuesByCharId.get(char.id)!
      if (shuffledValues[i] === originalValue) {
        fixedPoints.push({ playerId: char.player_id, value: originalValue })
      }
    }
    console.error(`[ReshuffleCard] CRITICAL: Failed to create valid derangement after all attempts:`, fixedPoints)
    throw new Error(`Failed to create valid derangement for ${category}. ${fixedPoints.length} player(s) would keep original value. This may happen if all players have the same value.`)
  }

  // Update characteristics with new values for ALL players
  // Use service role client to bypass RLS, as this is a system action
  // RLS policies only allow players to update their own characteristics or host to update any,
  // but reshuffle card needs to update characteristics of all players
  console.log(`[ReshuffleCard] Starting to update ${characteristics.length} characteristics with shuffled values`)
  
  let serviceRoleClient: any = null
  try {
    serviceRoleClient = createServiceRoleClient()
    console.log(`[ReshuffleCard] Created service role client for bypassing RLS`)
  } catch (serviceRoleError: any) {
    console.warn(`[ReshuffleCard] Could not create service role client:`, serviceRoleError?.message)
    console.log(`[ReshuffleCard] Will try with regular client (may fail due to RLS restrictions)`)
  }
  
  // Use service role client if available, otherwise fall back to regular client
  const updateClient = serviceRoleClient || supabase
  
  const assignments: Array<{ charId: string; playerId: string; original: string; new: string }> = []
  
  for (let i = 0; i < characteristics.length; i++) {
    const char = characteristics[i]
    const newValue = shuffledValues[i]
    const originalValue = originalValuesByCharId.get(char.id)!

    console.log(`[ReshuffleCard] Updating characteristic ${i + 1}/${characteristics.length}:`, {
      charId: char.id,
      playerId: char.player_id,
      originalValue,
      newValue,
      changed: originalValue !== newValue,
      usingServiceRole: !!serviceRoleClient,
    })

    const { error: updateError, data: updatedData } = await updateClient
      .from("player_characteristics")
      .update({ value: newValue })
      .eq("id", char.id)
      .select()

    if (updateError) {
      console.error(`[ReshuffleCard] ERROR updating characteristic ${char.id}:`, {
        error: updateError,
        code: updateError.code,
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
        usingServiceRole: !!serviceRoleClient,
      })
      
      // If update failed with RLS error and we're using regular client, try with service role
      if (!serviceRoleClient && (updateError.code === "42501" || updateError.message?.includes("RLS") || updateError.message?.includes("permission"))) {
        console.log(`[ReshuffleCard] Update failed due to RLS, trying with service role client...`)
        try {
          const fallbackServiceClient = createServiceRoleClient()
          const { error: fallbackError, data: fallbackData } = await fallbackServiceClient
            .from("player_characteristics")
            .update({ value: newValue })
            .eq("id", char.id)
            .select()
          
          if (fallbackError) {
            console.error(`[ReshuffleCard] Fallback service role client also failed:`, fallbackError)
            throw new Error(`Failed to update characteristic ${char.id} even with service role: ${fallbackError.message}`)
          }
          
          console.log(`[ReshuffleCard] Successfully updated characteristic ${char.id} using service role fallback`)
          assignments.push({
            charId: char.id,
            playerId: char.player_id,
            original: originalValue,
            new: newValue,
          })
          continue
        } catch (fallbackError: any) {
          throw new Error(`Failed to update characteristic for player: ${fallbackError.message}`)
        }
      }
      
      throw new Error(`Failed to update characteristic for player: ${updateError.message}`)
    }

    if (!updatedData || updatedData.length === 0) {
      console.warn(`[ReshuffleCard] WARNING: No rows updated for characteristic ${char.id}`)
    } else {
      console.log(`[ReshuffleCard] Successfully updated characteristic ${char.id} for player ${char.player_id}`)
    }

    assignments.push({
      charId: char.id,
      playerId: char.player_id,
      original: originalValue,
      new: newValue,
    })
  }

  console.log(`[ReshuffleCard] ✅ Completed redistribution of ${category} characteristics:`, {
    total: characteristics.length,
    updated: assignments.length,
    assignments: assignments.map((a) => ({
      playerId: a.playerId.substring(0, 8) + "...",
      charId: a.charId.substring(0, 8) + "...",
      original: a.original,
      new: a.new,
      changed: a.original !== a.new,
    })),
  })

  return { type: "reshuffle", category, redistributed: characteristics.length }
}

async function handleRevoteCard(supabase: any, playerId: string, roomId: string) {
  // Force all players to revote (clear all votes for current round)
  const { data: room, error: roomError } = await supabase
    .from("game_rooms")
    .select("current_round, phase")
    .eq("id", roomId)
    .single()

  if (roomError) throw roomError

  if (room.phase !== "voting") {
    throw new Error("Can only use revote card during voting phase")
  }

  // Delete all votes for current round
  const { error: deleteError } = await supabase
    .from("votes")
    .delete()
    .eq("room_id", roomId)
    .eq("round", room.current_round)

  if (deleteError) throw deleteError

  return { type: "revote", round: room.current_round }
}

async function handleReplaceProfessionCard(
  supabase: any,
  playerId: string,
  roomId: string,
  targetPlayerId: string,
  characteristicId: string,
) {
  // Replace an open profession card with a random one from deck
  const { data: characteristic, error: charError } = await supabase
    .from("player_characteristics")
    .select("*")
    .eq("player_id", targetPlayerId)
    .eq("id", characteristicId)
    .eq("category", "profession")
    .single()

  if (charError || !characteristic) {
    throw new Error("Profession characteristic not found")
  }

  if (!characteristic.is_revealed) {
    throw new Error("Only revealed profession cards can be replaced")
  }

  // Get random profession
  const { getRandomCharacteristic } = await import("@/lib/game/characteristics")
  const newValue = getRandomCharacteristic("profession")

  if (!newValue) {
    throw new Error("Cannot generate random profession")
  }

  // Use service role (RLS blocks updating target player's characteristic)
  let updateClient: any = supabase
  try {
    updateClient = createServiceRoleClient()
  } catch {
    console.warn("[SpecialCards] Service role unavailable for replace-profession")
  }
  const { error: updateError } = await updateClient
    .from("player_characteristics")
    .update({ value: newValue })
    .eq("id", characteristicId)

  if (updateError) throw updateError

  return { type: "replace-profession", characteristicId, newValue, oldValue: characteristic.value }
}

async function handleReplaceHealthCard(
  supabase: any,
  playerId: string,
  roomId: string,
  targetPlayerId: string,
  characteristicId: string,
) {
  // Replace an open health card with a random one from deck
  const { data: characteristic, error: charError } = await supabase
    .from("player_characteristics")
    .select("*")
    .eq("player_id", targetPlayerId)
    .eq("id", characteristicId)
    .eq("category", "health")
    .single()

  if (charError || !characteristic) {
    throw new Error("Health characteristic not found")
  }

  if (!characteristic.is_revealed) {
    throw new Error("Only revealed health cards can be replaced")
  }

  // Get random health
  const { getRandomCharacteristic } = await import("@/lib/game/characteristics")
  const newValue = getRandomCharacteristic("health")

  if (!newValue) {
    throw new Error("Cannot generate random health")
  }

  // Use service role (RLS blocks updating target player's characteristic)
  let updateClient: any = supabase
  try {
    updateClient = createServiceRoleClient()
  } catch {
    console.warn("[SpecialCards] Service role unavailable for replace-health")
  }
  const { error: updateError } = await updateClient
    .from("player_characteristics")
    .update({ value: newValue })
    .eq("id", characteristicId)

  if (updateError) throw updateError

  return { type: "replace-health", characteristicId, newValue, oldValue: characteristic.value }
}
