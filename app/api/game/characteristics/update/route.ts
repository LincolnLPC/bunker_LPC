import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// POST - Update characteristic value
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
    const { roomId, playerId, characteristicId, newValue } = body

    if (!roomId || !playerId || !characteristicId || !newValue) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Verify user is host
    const { data: room, error: roomError } = await supabase
      .from("game_rooms")
      .select("host_id")
      .eq("id", roomId)
      .single()

    if (roomError || !room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 })
    }

    if (room.host_id !== user.id) {
      return NextResponse.json({ error: "Only host can update characteristics" }, { status: 403 })
    }

    // Verify player belongs to room
    const { data: player, error: playerError } = await supabase
      .from("game_players")
      .select("id")
      .eq("id", playerId)
      .eq("room_id", roomId)
      .single()

    if (playerError || !player) {
      return NextResponse.json({ error: "Player not found in this room" }, { status: 404 })
    }

    // Update characteristic
    const { error: updateError } = await supabase
      .from("player_characteristics")
      .update({ value: newValue })
      .eq("id", characteristicId)
      .eq("player_id", playerId)

    if (updateError) throw updateError

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating characteristic:", error)
    return NextResponse.json({ error: "Failed to update characteristic" }, { status: 500 })
  }
}
