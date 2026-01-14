import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

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
    
    // Count actual players (excluding host if in "host_only" mode)
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
    // In manual mode, don't start timer (round_started_at stays null)
    const updateData: any = {
      phase: "playing",
      current_round: 1,
    }
    
    // Only start timer in automatic mode
    if (roundMode === "automatic") {
      updateData.round_started_at = new Date().toISOString()
    } else {
      // In manual mode, clear any existing timer
      updateData.round_started_at = null
    }
    
    const { error: updateError } = await supabase
      .from("game_rooms")
      .update(updateData)
      .eq("id", roomId)

    if (updateError) throw updateError

    // Grant special cards to all players
    try {
      // TEMPORARY: All card types for testing
      const cardTypes: Array<"exchange" | "immunity" | "reroll" | "reveal" | "steal" | "double-vote" | "no-vote-against" | "reshuffle" | "revote" | "replace-profession" | "replace-health"> = [
        "exchange",
        "immunity",
        "reroll",
        "reveal",
        "steal",
        "double-vote",
        "no-vote-against",
        "reshuffle",
        "revote",
        "replace-profession",
        "replace-health",
      ]

      // TEMPORARY: Give ALL cards to each player for testing
      const cardsToInsert = room.game_players.flatMap((player: any) => {
        return cardTypes.map((cardType) => ({
          player_id: player.id,
          room_id: roomId,
          card_type: cardType,
          is_used: false,
        }))
      })

      if (cardsToInsert.length > 0) {
        const { error: insertError } = await supabase.from("special_cards").insert(cardsToInsert)

        if (insertError) {
          console.warn("[GameStart] Failed to grant special cards:", insertError)
          // Don't fail game start if card granting fails
        }
      }
    } catch (grantError) {
      console.warn("[GameStart] Error granting special cards:", grantError)
      // Don't fail game start if card granting fails
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error starting game:", error)
    return NextResponse.json({ error: "Failed to start game" }, { status: 500 })
  }
}
