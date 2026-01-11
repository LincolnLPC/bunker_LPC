import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// POST - Leave room (remove player from game_players)
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
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Get room and verify player
    const { data: room, error: roomError } = await supabase
      .from("game_rooms")
      .select("*, game_players(*)")
      .eq("id", roomId)
      .single()

    if (roomError || !room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 })
    }

    // Find the player
    const player = room.game_players?.find((p: any) => p.id === playerId)
    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    // Verify player belongs to user
    if (player.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Check if player is host
    const isHost = room.host_id === user.id

    // If host is leaving, close/delete the room
    if (isHost) {
      console.log("[Leave] Host is leaving, closing room:", roomId)

      // Delete all players from the room (cascade will handle characteristics, votes, etc.)
      const { error: deletePlayersError } = await supabase
        .from("game_players")
        .delete()
        .eq("room_id", roomId)

      if (deletePlayersError) {
        console.error("[Leave] Error deleting players:", deletePlayersError)
        throw deletePlayersError
      }

      // Delete all votes for this room
      const { error: deleteVotesError } = await supabase
        .from("votes")
        .delete()
        .eq("room_id", roomId)

      if (deleteVotesError) {
        console.error("[Leave] Error deleting votes:", deleteVotesError)
        // Don't throw, votes are not critical
      }

      // Delete all chat messages for this room
      const { error: deleteChatError } = await supabase
        .from("chat_messages")
        .delete()
        .eq("room_id", roomId)

      if (deleteChatError) {
        console.error("[Leave] Error deleting chat messages:", deleteChatError)
        // Don't throw, chat messages are not critical
      }

      // Finally, delete the room itself
      const { error: deleteRoomError } = await supabase
        .from("game_rooms")
        .delete()
        .eq("id", roomId)

      if (deleteRoomError) {
        console.error("[Leave] Error deleting room:", deleteRoomError)
        throw deleteRoomError
      }

      console.log("[Leave] Room closed successfully:", roomId)
      return NextResponse.json({ success: true, roomClosed: true })
    } else {
      // Regular player leaving - just remove them from game_players
      const { error: deleteError } = await supabase
        .from("game_players")
        .delete()
        .eq("id", playerId)

      if (deleteError) {
        console.error("[Leave] Error deleting player:", deleteError)
        throw deleteError
      }

      console.log("[Leave] Player removed successfully:", playerId)
      return NextResponse.json({ success: true, roomClosed: false })
    }
  } catch (error) {
    console.error("[Leave] Error leaving room:", error)
    return NextResponse.json(
      { error: "Failed to leave room", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
