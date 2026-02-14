import { NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"

// POST - Host kicks a player from the room
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
    const { roomId, playerId } = body

    if (!roomId || !playerId) {
      return NextResponse.json({ error: "roomId and playerId are required" }, { status: 400 })
    }

    const { data: room, error: roomError } = await supabase
      .from("game_rooms")
      .select("id, host_id")
      .eq("id", roomId)
      .single()

    if (roomError || !room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 })
    }

    if (room.host_id !== user.id) {
      return NextResponse.json({ error: "Only host can kick players" }, { status: 403 })
    }

    const { data: player, error: playerError } = await supabase
      .from("game_players")
      .select("id, user_id")
      .eq("id", playerId)
      .eq("room_id", roomId)
      .single()

    if (playerError || !player) {
      return NextResponse.json({ error: "Player not found in room" }, { status: 404 })
    }

    // Cannot kick host
    if (player.user_id === room.host_id) {
      return NextResponse.json({ error: "Cannot kick the host" }, { status: 400 })
    }

    // Use service role - RLS only allows users to delete their own player
    const adminClient = createServiceRoleClient()
    const { error: deleteError } = await adminClient
      .from("game_players")
      .delete()
      .eq("id", playerId)

    if (deleteError) throw deleteError

    return NextResponse.json({ success: true, kickedPlayerId: playerId })
  } catch (error) {
    console.error("[Kick] Error:", error)
    return NextResponse.json(
      { error: "Failed to kick player", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
