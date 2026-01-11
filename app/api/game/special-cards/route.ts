import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { validatePlayerId, validateRoomId } from "@/lib/security/validation"

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
    const { data: cards, error: cardsError } = await supabase
      .from("special_cards")
      .select("*")
      .eq("player_id", playerId)
      .eq("room_id", roomId)
      .order("created_at", { ascending: true })

    if (cardsError) {
      console.error("[SpecialCards] Error fetching cards:", cardsError)
      throw cardsError
    }

    return NextResponse.json({ cards: cards || [] })
  } catch (error) {
    console.error("[SpecialCards] Error:", error)
    return NextResponse.json({ error: "Failed to fetch special cards" }, { status: 500 })
  }
}

// POST - Use a special card
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

      case "peek":
        if (!targetPlayerId || !characteristicId) {
          return NextResponse.json(
            { error: "Target player and characteristic required for peek" },
            { status: 400 }
          )
        }
        actionResult = await handlePeekCard(supabase, playerId, roomId, targetPlayerId, characteristicId)
        break

      case "reveal":
        if (!targetPlayerId || !characteristicId) {
          return NextResponse.json(
            { error: "Target player and characteristic required for reveal" },
            { status: 400 }
          )
        }
        actionResult = await handleRevealCard(supabase, playerId, roomId, targetPlayerId, characteristicId)
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

      case "discard-health":
        if (!targetPlayerId || !characteristicId) {
          return NextResponse.json(
            { error: "Target player and characteristic required for discard-health" },
            { status: 400 }
          )
        }
        actionResult = await handleDiscardHealthCard(supabase, playerId, roomId, targetPlayerId, characteristicId)
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
  } catch (error) {
    console.error("[SpecialCards] Error using card:", error)
    return NextResponse.json({ error: "Failed to use special card" }, { status: 500 })
  }
}

// Helper functions for card actions

async function handleExchangeCard(
  supabase: any,
  playerId: string,
  roomId: string,
  targetPlayerId: string,
  characteristicId: string,
) {
  // Exchange one characteristic with another player
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

  // Exchange values
  const playerValue = playerChars.value
  const targetValue = targetChars.value

  const { error: updatePlayerError } = await supabase
    .from("player_characteristics")
    .update({ value: targetValue })
    .eq("id", characteristicId)

  if (updatePlayerError) throw updatePlayerError

  const { error: updateTargetError } = await supabase
    .from("player_characteristics")
    .update({ value: playerValue })
    .eq("id", targetChars.id)

  if (updateTargetError) throw updateTargetError

  return { type: "exchange", exchanged: true, characteristicId, targetCharacteristicId: targetChars.id }
}

async function handlePeekCard(
  supabase: any,
  playerId: string,
  roomId: string,
  targetPlayerId: string,
  characteristicId: string,
) {
  // Peek at a hidden characteristic (temporary reveal for current player only)
  // In this implementation, we'll create a temporary peek record
  // For now, just reveal it temporarily (mark as peeked for this player)
  const { data: characteristic, error: charError } = await supabase
    .from("player_characteristics")
    .select("*")
    .eq("player_id", targetPlayerId)
    .eq("id", characteristicId)
    .single()

  if (charError || !characteristic) {
    throw new Error("Characteristic not found")
  }

  // Return the characteristic value (it's peeked, not permanently revealed)
  return {
    type: "peek",
    characteristicId,
    value: characteristic.value,
    category: characteristic.category,
    name: characteristic.name,
  }
}

async function handleRevealCard(
  supabase: any,
  playerId: string,
  roomId: string,
  targetPlayerId: string,
  characteristicId: string,
) {
  // Reveal a characteristic to all players
  const { error: updateError } = await supabase
    .from("player_characteristics")
    .update({ is_revealed: true })
    .eq("id", characteristicId)
    .eq("player_id", targetPlayerId)

  if (updateError) throw updateError

  return { type: "reveal", characteristicId, revealed: true }
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
  // Steal a characteristic from another player
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
    // Replace existing characteristic
    const { error: updateError } = await supabase
      .from("player_characteristics")
      .update({ value: targetChar.value })
      .eq("id", existingChar.id)

    if (updateError) throw updateError

    // Remove from target player
    const { error: deleteError } = await supabase
      .from("player_characteristics")
      .delete()
      .eq("id", characteristicId)

    if (deleteError) throw deleteError

    return { type: "steal", characteristicId, stolenValue: targetChar.value, replacedCharacteristicId: existingChar.id }
  } else {
    // Create new characteristic for player
    const { error: insertError } = await supabase.from("player_characteristics").insert({
      player_id: playerId,
      category: targetChar.category,
      name: targetChar.name,
      value: targetChar.value,
      is_revealed: false,
      sort_order: targetChar.sort_order,
    })

    if (insertError) throw insertError

    // Remove from target player
    const { error: deleteError } = await supabase
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

async function handleDiscardHealthCard(
  supabase: any,
  playerId: string,
  roomId: string,
  targetPlayerId: string,
  characteristicId: string,
) {
  // Discard (delete) an open health card from any player
  const { data: characteristic, error: charError } = await supabase
    .from("player_characteristics")
    .select("*")
    .eq("player_id", targetPlayerId)
    .eq("id", characteristicId)
    .eq("category", "health")
    .single()

  if (charError || !characteristic) {
    throw new Error("Health characteristic not found or not open")
  }

  if (!characteristic.is_revealed) {
    throw new Error("Only revealed health cards can be discarded")
  }

  // Delete the characteristic
  const { error: deleteError } = await supabase
    .from("player_characteristics")
    .delete()
    .eq("id", characteristicId)

  if (deleteError) throw deleteError

  return { type: "discard-health", characteristicId, discardedValue: characteristic.value }
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
  // Collect all open cards of specified category from non-eliminated players, shuffle and redeal
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

  // Get all open characteristics of the category
  const { data: characteristics, error: charsError } = await supabase
    .from("player_characteristics")
    .select("*")
    .in("player_id", playerIds)
    .eq("category", category)
    .eq("is_revealed", true)

  if (charsError) throw charsError

  if (!characteristics || characteristics.length === 0) {
    throw new Error(`No open ${category} characteristics found`)
  }

  // Shuffle the values
  const values = characteristics.map((c: any) => c.value)
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[values[i], values[j]] = [values[j], values[i]]
  }

  // Redistribute
  for (let i = 0; i < characteristics.length; i++) {
    const char = characteristics[i]
    const newValue = values[i % values.length]

    const { error: updateError } = await supabase
      .from("player_characteristics")
      .update({ value: newValue })
      .eq("id", char.id)

    if (updateError) throw updateError
  }

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

  const { error: updateError } = await supabase
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

  const { error: updateError } = await supabase
    .from("player_characteristics")
    .update({ value: newValue })
    .eq("id", characteristicId)

  if (updateError) throw updateError

  return { type: "replace-health", characteristicId, newValue, oldValue: characteristic.value }
}
