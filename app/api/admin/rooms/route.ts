import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET - Get all rooms for admin
export async function GET(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check if user is admin
  const { data: adminRole, error: adminError } = await supabase
    .from("admin_roles")
    .select("role")
    .eq("user_id", user.id)
    .single()

  if (adminError || !adminRole) {
    return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 })
  }

  try {
    // Get all rooms with host and player info
    const { data: rooms, error: roomsError } = await supabase
      .from("game_rooms")
      .select(
        `
        *,
        host:profiles!game_rooms_host_id_fkey(id, username, display_name),
        game_players(id, user_id, name, is_eliminated, joined_at, last_seen_at)
      `
      )
      .order("created_at", { ascending: false })
      .limit(100)

    if (roomsError) {
      console.error("[AdminRooms] Error fetching rooms:", roomsError)
      throw roomsError
    }

    // Format rooms with player counts
    // Filter out inactive players (those without recent heartbeat)
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString()
    
    const formattedRooms = rooms?.map((room: any) => {
      const allPlayers = room.game_players || []
      
      // Filter active players (those with recent heartbeat or joined recently)
      const activePlayers = allPlayers.filter((p: any) => {
        // If player has last_seen_at, check if it's recent
        if (p.last_seen_at) {
          return new Date(p.last_seen_at) >= new Date(thirtySecondsAgo)
        }
        // If no last_seen_at but joined recently (within last 5 minutes), consider active
        if (p.joined_at) {
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
          return new Date(p.joined_at) >= new Date(fiveMinutesAgo)
        }
        // If no timestamps, consider inactive
        return false
      })
      
      return {
        ...room,
        player_count: allPlayers.length,
        active_player_count: activePlayers.filter((p: any) => !p.is_eliminated).length,
        real_player_count: activePlayers.length, // Actually active players
        host_name: room.host?.display_name || room.host?.username || "Неизвестно",
        is_empty: activePlayers.length === 0, // Flag for empty rooms
      }
    }) || []

    return NextResponse.json({
      success: true,
      rooms: formattedRooms,
      count: formattedRooms.length,
    })
  } catch (error) {
    console.error("[AdminRooms] Error:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch rooms",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

// DELETE - Delete a specific room
export async function DELETE(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check if user is admin
  const { data: adminRole, error: adminError } = await supabase
    .from("admin_roles")
    .select("role")
    .eq("user_id", user.id)
    .single()

  if (adminError || !adminRole) {
    return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get("roomId")

    if (!roomId) {
      return NextResponse.json({ error: "roomId is required" }, { status: 400 })
    }

    console.log("[AdminRooms] Deleting room:", roomId, "by admin:", user.id)

    // Get room info before deletion
    const { data: room } = await supabase.from("game_rooms").select("room_code").eq("id", roomId).single()

    // Delete all related data
    await Promise.all([
      supabase.from("game_players").delete().eq("room_id", roomId),
      supabase.from("votes").delete().eq("room_id", roomId),
      supabase.from("chat_messages").delete().eq("room_id", roomId),
    ])

    // Delete the room
    const { error: deleteError } = await supabase.from("game_rooms").delete().eq("id", roomId)

    if (deleteError) {
      console.error("[AdminRooms] Error deleting room:", deleteError)
      throw deleteError
    }

    console.log("[AdminRooms] Room deleted successfully:", roomId)

    return NextResponse.json({
      success: true,
      message: `Room ${room?.room_code || roomId} deleted successfully`,
    })
  } catch (error) {
    console.error("[AdminRooms] Error deleting room:", error)
    return NextResponse.json(
      {
        error: "Failed to delete room",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
