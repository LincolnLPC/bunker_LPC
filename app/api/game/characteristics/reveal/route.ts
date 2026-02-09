import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// POST - Reveal characteristic
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
    const { roomId, playerId, characteristicId } = body

    if (!roomId || !playerId || !characteristicId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Get room to check current round
    const { data: room, error: roomError } = await supabase
      .from("game_rooms")
      .select("current_round")
      .eq("id", roomId)
      .single()

    if (roomError || !room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 })
    }

    // Verify player owns this characteristic or is host
    const { data: player, error: playerError } = await supabase
      .from("game_players")
      .select("id, user_id, room_id, game_rooms!inner(host_id)")
      .eq("id", playerId)
      .single()

    if (playerError || !player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    // Check if user owns the characteristic or is host
    const isOwner = player.user_id === user.id
    const isHost = (player as any).game_rooms?.host_id === user.id

    if (!isOwner && !isHost) {
      return NextResponse.json({ error: "Unauthorized to reveal this characteristic" }, { status: 403 })
    }

    // Update characteristic
    const { error: updateError } = await supabase
      .from("player_characteristics")
      .update({
        is_revealed: true,
        reveal_round: room.current_round || 0,
      })
      .eq("id", characteristicId)
      .eq("player_id", playerId)

    if (updateError) throw updateError

    // Add system message to chat
    const { data: char, error: charError } = await supabase
      .from("player_characteristics")
      .select("name, value, game_players!inner(name)")
      .eq("id", characteristicId)
      .single()

    if (!charError && char) {
      const playerName = (char as any).game_players?.name || "Игрок"
      await supabase.from("chat_messages").insert({
        room_id: roomId,
        player_id: null,
        message: `${playerName} раскрыл характеристику: ${char.name} — ${char.value}`,
        message_type: "system",
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error revealing characteristic:", error)
    return NextResponse.json({ error: "Failed to reveal characteristic" }, { status: 500 })
  }
}
