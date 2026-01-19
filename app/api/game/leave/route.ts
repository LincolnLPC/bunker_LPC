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
    // Handle both JSON body and Blob (from sendBeacon)
    let body: any
    const contentType = request.headers.get("content-type")
    
    if (contentType?.includes("application/json")) {
      body = await request.json()
    } else {
      // Handle Blob from sendBeacon
      const blob = await request.blob()
      const text = await blob.text()
      try {
        body = JSON.parse(text)
      } catch {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
      }
    }
    
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
      // Regular player leaving - remove them from game_players
      // If game has started (not in waiting phase), add them as spectator with was_player = true
      const gameStarted = room.phase !== "waiting" && room.phase !== "finished"
      
      const { error: deleteError } = await supabase
        .from("game_players")
        .delete()
        .eq("id", playerId)

      if (deleteError) {
        console.error("[Leave] Error deleting player:", deleteError)
        throw deleteError
      }

      // If game has started, add player as spectator so they can rejoin
      if (gameStarted) {
        console.log("[Leave] Game has started, adding player as spectator with was_player=true")
        const { error: spectatorError } = await supabase
          .from("game_spectators")
          .upsert({
            room_id: roomId,
            user_id: user.id,
            joined_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
            was_player: true, // Mark as previous player
          }, {
            onConflict: "room_id,user_id",
            ignoreDuplicates: false
          })

        if (spectatorError) {
          console.error("[Leave] Error adding spectator:", spectatorError)
          // Don't throw - player is already removed, spectator is optional
        } else {
          console.log("[Leave] Player added as spectator with was_player=true")
        }
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
