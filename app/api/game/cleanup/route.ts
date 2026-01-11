import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// POST - Cleanup rooms without host
// This endpoint checks all rooms and deletes those where the host is not in the players list
export async function POST(request: Request) {
  const supabase = await createClient()

  try {
    // Get all rooms that are not finished
    const { data: rooms, error: roomsError } = await supabase
      .from("game_rooms")
      .select("id, host_id, game_players(user_id)")
      .neq("phase", "finished")

    if (roomsError) {
      console.error("[Cleanup] Error fetching rooms:", roomsError)
      throw roomsError
    }

    if (!rooms || rooms.length === 0) {
      return NextResponse.json({ success: true, deletedCount: 0, message: "No rooms to check" })
    }

    console.log(`[Cleanup] Checking ${rooms.length} rooms for orphaned hosts`)

    const roomsToDelete: string[] = []

    // Check each room
    for (const room of rooms) {
      const hostId = room.host_id
      const players = room.game_players || []

      // Check if host is in the players list
      const hostInRoom = players.some((p: any) => p.user_id === hostId)

      if (!hostInRoom) {
        console.log(`[Cleanup] Room ${room.id} has no host in players list, marking for deletion`)
        roomsToDelete.push(room.id)
      }
    }

    if (roomsToDelete.length === 0) {
      return NextResponse.json({
        success: true,
        deletedCount: 0,
        message: "All rooms have their hosts present",
      })
    }

    console.log(`[Cleanup] Deleting ${roomsToDelete.length} orphaned rooms`)

    // Delete all related data in parallel (faster)
    const [deletePlayersResult, deleteVotesResult, deleteChatResult] = await Promise.all([
      supabase.from("game_players").delete().in("room_id", roomsToDelete),
      supabase.from("votes").delete().in("room_id", roomsToDelete),
      supabase.from("chat_messages").delete().in("room_id", roomsToDelete),
    ])

    if (deletePlayersResult.error) {
      console.error("[Cleanup] Error deleting players:", deletePlayersResult.error)
      // Continue anyway, try to delete rooms
    }

    if (deleteVotesResult.error) {
      console.error("[Cleanup] Error deleting votes:", deleteVotesResult.error)
      // Continue anyway
    }

    if (deleteChatResult.error) {
      console.error("[Cleanup] Error deleting chat messages:", deleteChatResult.error)
      // Continue anyway
    }

    // Finally, delete the rooms themselves
    const { error: deleteRoomsError } = await supabase
      .from("game_rooms")
      .delete()
      .in("id", roomsToDelete)

    if (deleteRoomsError) {
      console.error("[Cleanup] Error deleting rooms:", deleteRoomsError)
      throw deleteRoomsError
    }

    console.log(`[Cleanup] Successfully deleted ${roomsToDelete.length} orphaned rooms`)

    return NextResponse.json({
      success: true,
      deletedCount: roomsToDelete.length,
      deletedRoomIds: roomsToDelete,
      message: `Deleted ${roomsToDelete.length} orphaned room(s)`,
    })
  } catch (error) {
    console.error("[Cleanup] Error cleaning up rooms:", error)
    return NextResponse.json(
      {
        error: "Failed to cleanup rooms",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
