import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { validateRoomId } from "@/lib/security/validation"

// POST - Grant special cards to players (called when game starts)
export async function POST(request: Request) {
  const supabase = await createClient()

  // This should be called with service role or by host
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { roomId } = body

    if (!roomId) {
      return NextResponse.json({ error: "Room ID required" }, { status: 400 })
    }

    // Validate room ID
    const roomIdValidation = validateRoomId(roomId)
    if (!roomIdValidation.valid) {
      return NextResponse.json(
        {
          error: "Validation failed",
          errors: roomIdValidation.errors,
        },
        { status: 400 }
      )
    }

    // Get room and verify host
    const { data: room, error: roomError } = await supabase
      .from("game_rooms")
      .select("*, host_id")
      .eq("id", roomId)
      .single()

    if (roomError || !room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 })
    }

    if (room.host_id !== user.id) {
      return NextResponse.json({ error: "Only host can grant cards" }, { status: 403 })
    }

    // Get all players in room
    const { data: players, error: playersError } = await supabase
      .from("game_players")
      .select("id")
      .eq("room_id", roomId)

    if (playersError) {
      console.error("[SpecialCards] Error fetching players:", playersError)
      throw playersError
    }

    if (!players || players.length === 0) {
      return NextResponse.json({ error: "No players in room" }, { status: 400 })
    }

    // Card types to grant to each player
    const cardTypes: Array<"exchange" | "peek" | "immunity" | "reroll" | "reveal" | "steal"> = [
      "exchange",
      "peek",
      "immunity",
    ]

    // Grant cards to each player
    const cardsToInsert = players.flatMap((player) =>
      cardTypes.map((cardType) => ({
        player_id: player.id,
        room_id: roomId,
        card_type: cardType,
        is_used: false,
      }))
    )

    const { error: insertError } = await supabase.from("special_cards").insert(cardsToInsert)

    if (insertError) {
      console.error("[SpecialCards] Error inserting cards:", insertError)
      throw insertError
    }

    return NextResponse.json({
      success: true,
      cardsGranted: cardsToInsert.length,
      playersCount: players.length,
    })
  } catch (error) {
    console.error("[SpecialCards] Error granting cards:", error)
    return NextResponse.json({ error: "Failed to grant special cards" }, { status: 500 })
  }
}
