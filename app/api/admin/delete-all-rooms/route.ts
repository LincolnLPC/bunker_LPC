import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// POST - Delete all game rooms and related data
// WARNING: This will delete ALL rooms, players, votes, chat messages, and characteristics
export async function POST(request: Request) {
  const supabase = await createClient()

  try {
    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[DeleteAllRooms] Starting deletion of all rooms by user:", user.id)

    // Get count before deletion for reporting
    const { count: roomsCount } = await supabase.from("game_rooms").select("*", { count: "exact", head: true })
    const { count: playersCount } = await supabase.from("game_players").select("*", { count: "exact", head: true })
    const { count: votesCount } = await supabase.from("votes").select("*", { count: "exact", head: true })
    const { count: chatCount } = await supabase.from("chat_messages").select("*", { count: "exact", head: true })
    const { count: characteristicsCount } = await supabase
      .from("player_characteristics")
      .select("*", { count: "exact", head: true })

    console.log("[DeleteAllRooms] Counts before deletion:", {
      rooms: roomsCount || 0,
      players: playersCount || 0,
      votes: votesCount || 0,
      chat: chatCount || 0,
      characteristics: characteristicsCount || 0,
    })

    // Delete all related data
    // Note: We need to delete in order due to foreign key constraints
    // First, get all room IDs
    const { data: allRooms } = await supabase.from("game_rooms").select("id")
    const roomIds = allRooms?.map((r) => r.id) || []

    if (roomIds.length > 0) {
      // Delete all related data for these rooms
      await Promise.all([
        supabase.from("votes").delete().in("room_id", roomIds),
        supabase.from("chat_messages").delete().in("room_id", roomIds),
      ])

      // Delete all players (which will cascade delete characteristics)
      await supabase.from("game_players").delete().in("room_id", roomIds)
    } else {
      // If no rooms, still try to clean up orphaned data
      await Promise.all([
        supabase.from("votes").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
        supabase.from("chat_messages").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
        supabase.from("player_characteristics").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
        supabase.from("game_players").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
      ])
    }

    // Log any errors (but continue)
    if (deleteVotesResult.error) {
      console.error("[DeleteAllRooms] Error deleting votes:", deleteVotesResult.error)
    }
    if (deleteChatResult.error) {
      console.error("[DeleteAllRooms] Error deleting chat messages:", deleteChatResult.error)
    }
    if (deleteCharacteristicsResult.error) {
      console.error("[DeleteAllRooms] Error deleting characteristics:", deleteCharacteristicsResult.error)
    }
    if (deletePlayersResult.error) {
      console.error("[DeleteAllRooms] Error deleting players:", deletePlayersResult.error)
    }

    // Finally, delete all rooms
    const { error: deleteRoomsError } = roomIds.length > 0
      ? await supabase.from("game_rooms").delete().in("id", roomIds)
      : await supabase.from("game_rooms").delete().neq("id", "00000000-0000-0000-0000-000000000000")

    if (deleteRoomsError) {
      console.error("[DeleteAllRooms] Error deleting rooms:", deleteRoomsError)
      throw deleteRoomsError
    }

    console.log("[DeleteAllRooms] Successfully deleted all rooms and related data")

    return NextResponse.json({
      success: true,
      deleted: {
        rooms: roomsCount || 0,
        players: playersCount || 0,
        votes: votesCount || 0,
        chatMessages: chatCount || 0,
        characteristics: characteristicsCount || 0,
      },
      message: "All rooms and related data have been deleted",
    })
  } catch (error) {
    console.error("[DeleteAllRooms] Error deleting all rooms:", error)
    return NextResponse.json(
      {
        error: "Failed to delete all rooms",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
